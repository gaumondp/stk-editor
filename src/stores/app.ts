// Global application store: project state, undo/redo, dirty detection,
// and recent kits.
import { writable, get } from 'svelte/store';
import {
	api,
	parseUnreadablePads,
	type Project,
	type RecentStore,
	type ValidationResult,
	type CompileReport,
	type ExportReport,
	type FindMissingReport,
	type Sample
} from '../lib/commands';
import { success as notifySuccess, error as notifyError, warn as notifyWarn } from './notify';
import { t } from '../lib/i18n';

export interface KitStatus {
	id: string;
	label: string;
	kind:
		| 'saved'
		| 'modified'
		| 'saving'
		| 'compiling'
		| 'compile_ok'
		| 'compile_error'
		| 'save_error'
		| 'missing'
		| 'invalid';
}

const newProject = (): Project => ({
	format: 'smpltrek-kit-project',
	fmt_version: 1,
	app_version: '0.1.0',
	device: { profile: 'smpltrek', firmware: '3.2' },
	kit: { name: 'NewKit', pads: {} as Record<number, Sample>, notes: '' },
	compile: {} as Project['compile'],
	prefs: {} as Project['prefs']
});

// ---- primary state ----
export const project = writable<Project>(newProject());
export const projectPath = writable<string | null>(null);
export const dirty = writable(false);
export const status = writable<KitStatus>({ id: 'saved', label: 'Saved', kind: 'saved' });
export const recentStore = writable<RecentStore>({ entries: [] });
export const validation = writable<ValidationResult>({ errors: [], warnings: [] });

// ---- undo / redo ----
interface Snapshot {
	project: Project;
}
export const undoStack = writable<Snapshot[]>([]);
export const redoStack = writable<Snapshot[]>([]);

// ---- helpers (call these, do not mutate `project` directly) ----
/**
 * Marks the project as having unsaved changes and switches the status pill to
 * "modified". A falsy argument is a no-op, so this never silently clears dirty state.
 *
 * @param v Whether the project should be flagged dirty. Defaults to `true`.
 */
export function markDirty(v = true) {
	if (v) {
		dirty.set(true);
		status.update((_s) => ({ id: 'modified', label: 'Modified', kind: 'modified' }));
	}
}

/** Clears the dirty flag and resets the status pill to the saved state. */
export function setSaved() {
	dirty.set(false);
	status.update((_s) => ({ id: 'saved', label: 'Saved', kind: 'saved' }));
}

/**
 * Pushes the current project onto the undo stack (capped at 100 entries), applies
 * the replacement project, marks it dirty, and re-runs validation.
 *
 * @param newProject The project state to make current.
 */
export function commit(newProject: Project) {
	project.update((prev) => {
		undoStack.update((s) => [...s, { project: prev }].slice(-100));
		return newProject;
	});
	markDirty(true);
	refreshValidation(newProject);
}

/** Reverts to the previous undo snapshot, moving the current state onto the redo stack. */
export async function undo() {
	const s = get(undoStack);
	if (s.length === 0) return;
	const snap = s[s.length - 1];
	undoStack.update((x) => x.slice(0, -1));
	redoStack.update((x) => [...x, { project: get(project) }]);
	project.set(snap.project);
	markDirty(true);
	await validate(get(project));
}

/** Re-applies the most recently undone snapshot, moving the current state onto the undo stack. */
export async function redo() {
	const s = get(redoStack);
	if (s.length === 0) return;
	const snap = s[s.length - 1];
	redoStack.update((x) => x.slice(0, -1));
	undoStack.update((x) => [...x, { project: get(project) }]);
	project.set(snap.project);
	markDirty(true);
	await validate(get(project));
}

/**
 * Replaces the current state with a fresh empty kit and clears the project path.
 *
 * @param name Name for the new kit. Defaults to `'NewKit'`.
 * @returns The newly created project.
 */
export function newKit(name = 'NewKit'): Project {
	const p = newProject();
	p.kit.name = name;
	commit(p);
	projectPath.set(null);
	return p;
}

/** Closes the active kit after the shared unsaved-changes guard approves the action. */
export async function closeKit(): Promise<boolean> {
	if (!(await guardUnsaved())) return false;
	project.set(newProject());
	projectPath.set(null);
	undoStack.set([]);
	redoStack.set([]);
	validation.set({ errors: [], warnings: [] });
	setSaved();
	return true;
}

/**
 * Opens a kit from disk, replaces the current state, clears undo/redo history,
 * validates it, refreshes the recent list, and runs a best-effort missing-file
 * search that either opens the relink dialog or auto-links resolved files.
 *
 * @param path Absolute path to the kit JSON to open.
 * @returns The loaded project.
 */
export async function openKit(path: string) {
	status.update((_s) => ({ id: 'saving', label: 'Opening…', kind: 'saving' }));
	let p: Project;
	try {
		p = await api.openProject(path);
	} catch (e) {
		// A bad or unreadable path previously threw to the caller with no toast,
		// leaving the status pill stuck on "Opening…".
		status.update((_s) => ({ id: 'invalid', label: 'Invalid project', kind: 'invalid' }));
		notifyError(t('status.invalid'));
		throw e;
	}
	project.set(p);
	projectPath.set(path);
	undoStack.set([]);
	redoStack.set([]);
	setSaved();
	await validate(p);
	refreshRecent();
	// Auto-search missing files (S08) — best-effort, non-blocking
	try {
		const report = await api.findMissing(p, path);
		const unresolved = report.items.filter((i) => !i.resolved);
		if (unresolved.length) {
			status.update((_s) => ({ id: 'missing', label: 'Missing audio file', kind: 'missing' }));
			missingDialogOpen.set(true);
		} else if (report.items.length) {
			if (report.items.some((i) => i.found_path)) notifySuccess(t('toast.missing_auto_linked'));
		}
	} catch {}
	return p;
}

/**
 * Saves the current project, falling back to a save-as dialog when no path is
 * known. On success it updates the path, clears the dirty flag, and refreshes recents.
 *
 * @param pathOverride Optional path to save to instead of the current project path.
 * @returns The saved path, or `null` when the save was cancelled or failed.
 */
export async function saveKit(pathOverride?: string): Promise<string | null> {
	const path = pathOverride ?? get(projectPath);
	const p = get(project);
	status.update((_s) => ({ id: 'saving', label: 'Saving…', kind: 'saving' }));
	try {
		if (!path) return await saveAs(p);
		await api.saveProject(path, p);
		projectPath.set(path);
		setSaved();
		refreshRecent();
		return path;
	} catch (e) {
		const message = `Save failed: ${String(e)}`;
		status.update((_s) => ({ id: 'save_error', label: message, kind: 'save_error' }));
		notifyError(message);
		return null;
	}
}

/**
 * Prompts for a destination and saves the project as a new JSON file, updating the
 * project path and clearing the dirty flag on success.
 *
 * @param p Project to save. Defaults to the current project.
 * @returns The chosen path, or `null` when the dialog was cancelled.
 */
export async function saveAs(p = get(project)): Promise<string | null> {
	const { save } = await import('@tauri-apps/plugin-dialog');
	const out = await save({
		defaultPath: `${p.kit.name || 'kit'}.json`,
		filters: [{ name: 'SmplTrek Kit', extensions: ['json'] }]
	});
	if (!out) {
		if (get(dirty)) markDirty();
		else setSaved();
		return null;
	}
	await api.saveProject(out, p);
	projectPath.set(out);
	setSaved();
	refreshRecent();
	return out;
}

// ---- compile / export (spec §12, §13) ----
/**
 * Compiles the current kit into a device STK artifact, records the compile
 * metadata on the project, and surfaces warnings as toasts.
 *
 * @param outputPath Destination path for the compiled `.stk` file.
 * @param mono Whether to compile samples to mono. Defaults to `true`.
 * @param overwrite Whether to overwrite an existing file. Defaults to `false`.
 * @returns The compile report, or `null` when compilation failed.
 */
export async function compileKit(
	outputPath: string,
	mono = true,
	overwrite = false,
	skipUnreadable = false
): Promise<CompileReport | null> {
	const p = get(project);
	status.update((_s) => ({ id: 'compiling', label: 'Compiling…', kind: 'compiling' }));
	try {
		const report = await api.compile(p, outputPath, mono, overwrite, skipUnreadable);
		status.update((_s) => ({ id: 'compile_ok', label: 'Compilation succeeded', kind: 'compile_ok' }));
		p.compile = {
			last_compiled: new Date().toISOString(),
			output_path: report.output_path,
			target: 'smpltrek-3.2'
		};
		commit(p);
		if (report.warnings.length) notifyWarn(`${report.warnings.length} warnings`);
		notifySuccess(`${report.pads_filled} pads → ${report.bytes} B`);
		return report;
	} catch (e) {
		// A refused compile listing unreadable pads is not a failure to toast:
		// the caller shows a modal and may retry with skipUnreadable=true. Let
		// it propagate untouched so the caller can detect it. Leave the status
		// as-is; the caller drives the next state.
		if (parseUnreadablePads(e)) {
			throw e;
		}
		status.update((_s) => ({ id: 'compile_error', label: 'Compilation failed', kind: 'compile_error' }));
		notifyError(String(e));
		return null;
	}
}

/**
 * Exports the current kit to a directory using the given profile and reports the
 * number of files written.
 *
 * @param baseDir Destination directory for the export.
 * @param profile Export profile: `'hardware'` for device-only files or `'full'` for a complete package.
 * @param copySamples Whether to copy sample files into the export. Defaults to `true`.
 * @returns The export report, or `null` when the export failed.
 */
export async function exportKit(
	baseDir: string,
	profile: 'hardware' | 'full',
	copySamples = true
): Promise<ExportReport | null> {
	const p = get(project);
	try {
		const report = await api.export(p, { base_dir: baseDir, profile, copy_samples: copySamples });
		notifySuccess(t('toast.export_done_short', { count: report.paths.length }));
		return report;
	} catch (e) {
		notifyError(String(e));
		return null;
	}
}

/**
 * Searches for missing audio files across the whole kit and reports whether any
 * were re-linked or remain unresolved.
 *
 * @returns The find-missing report, or `null` when the search failed.
 */
export async function findMissingGlobal(): Promise<FindMissingReport | null> {
	const p = get(project);
	const path = get(projectPath);
	try {
		const report = await api.findMissing(p, path ?? '');
		if (report.items.some((item) => item.resolved)) notifySuccess(t('toast.missing_relinked'));
		if (report.items.some((item) => !item.resolved)) notifyWarn(t('toast.missing_not_found'));
		return report;
	} catch (e) {
		notifyError(String(e));
		return null;
	}
}

/**
 * Re-links a pad to a new audio file, updates the project, and syncs the recent
 * list's missing-files flag for the current project.
 *
 * @param pad The pad number to re-link.
 * @param newPath New audio file path to associate with the pad.
 * @param keepOriginal Whether to preserve the original path reference. Defaults to `true`.
 * @returns The updated project, or `null` when re-linking failed.
 */
export async function relink(pad: number, newPath: string, keepOriginal = true) {
	const p = get(project);
	try {
		const updated = await api.relink(p, pad, newPath, keepOriginal);
		project.set(updated);
		markDirty(true);
		notifySuccess(t('toast.pad_relinked', { pad }));
		// Sync recent has_missing_files for current project
		const path = get(projectPath);
		if (path) {
			const stillMissing = Object.values(updated.kit.pads).some((s) => s.file_name && !s.resolved_path);
			recentStore.update((store) => {
				const idx = store.entries.findIndex((e) => e.path === path);
				if (idx !== -1) store.entries[idx].has_missing_files = stillMissing;
				return store;
			});
		}
		return updated;
	} catch (e) {
		notifyError(String(e));
		return null;
	}
}

async function refreshValidation(p: Project) {
	try {
		const v = await api.validate(p);
		validation.set(v);
	} catch (e) {
		// Reached fire-and-forget from every pad mutation; an unhandled rejection
		// here would surface as an uncaught promise error with no user feedback.
		validation.set({ errors: [String(e)], warnings: [] });
		notifyError(t('status.invalid'));
	}
}

/**
 * Validates a project through the backend and stores the result, capturing any
 * thrown error as a single validation error.
 *
 * @param p Project to validate. Defaults to the current project.
 * @returns The validation result (errors and warnings).
 */
export async function validate(p = get(project)) {
	try {
		const v = await api.validate(p);
		validation.set(v);
		return v;
	} catch (e) {
		validation.set({ errors: [String(e)], warnings: [] });
		return { errors: [String(e)], warnings: [] };
	}
}

// ---- pad helpers ----
/**
 * Assigns a sample to a pad in one undoable change, filling in default parameter
 * values (volume, pan, pitch, fx_send) and a generated id where absent.
 *
 * @param pad The target pad number.
 * @param sample The sample to assign.
 * @param replace Whether to clear an existing assignment first. Defaults to `false`.
 */
export async function assignSample(pad: number, sample: import('../lib/commands').Sample, replace = false) {
	const p = structuredClone(get(project));
	if (replace) delete p.kit.pads[pad];
	p.kit.pads[pad] = {
		...sample,
		id: sample.id || `${pad}-${Date.now()}`,
		volume: sample.volume ?? 100,
		pan: sample.pan ?? 0,
		pitch: sample.pitch ?? 0,
		fx_send: sample.fx_send ?? 0,
		note: sample.note ?? undefined,
		original_file_name: sample.original_file_name ?? sample.file_name
	};
	commit(p);
}

/**
 * Removes a pad's sample assignment in one undoable change without deleting the
 * underlying audio file (spec §9.4).
 *
 * @param pad The pad number to clear.
 */
export async function removeSample(pad: number) {
	const p = structuredClone(get(project));
	// Remove the pad assignment but DO NOT delete the audio file (spec §9.4).
	delete p.kit.pads[pad];
	commit(p);
}

/** Removes every pad assignment in one undoable project change. */
export async function clearSamples() {
	const p = structuredClone(get(project));
	p.kit.pads = {};
	commit(p);
}

/** Moves an assigned sample or swaps complete assignments in one undoable change. */
export async function moveOrSwapSample(sourcePad: number, targetPad: number) {
	if (sourcePad === targetPad) return;
	const p = structuredClone(get(project));
	const source = p.kit.pads[sourcePad];
	if (!source) return;
	const target = p.kit.pads[targetPad];
	p.kit.pads[targetPad] = source;
	if (target) p.kit.pads[sourcePad] = target;
	else delete p.kit.pads[sourcePad];
	commit(p);
}

/**
 * Renames the kit in one undoable change.
 *
 * @param name The new kit name.
 */
export async function setKitName(name: string) {
	const p = structuredClone(get(project));
	p.kit.name = name;
	commit(p);
}

/**
 * Updates the kit's free-text notes in one undoable change.
 *
 * @param notes The new notes text.
 */
export async function setNotes(notes: string) {
	const p = structuredClone(get(project));
	p.kit.notes = notes;
	commit(p);
}

let paramDebounceTimer: number | null = null;
let pendingParam: { pad: number; param: 'volume' | 'pan' | 'pitch' | 'fx_send'; value: number } | null = null;

/**
 * Sets a pad parameter, updating the UI immediately and coalescing rapid changes
 * into a single undo entry via a 300ms debounce (spec S13).
 *
 * @param pad The pad number being edited.
 * @param param Which parameter to set: `'volume'`, `'pan'`, `'pitch'`, or `'fx_send'`.
 * @param value The new integer value.
 */
export async function setParam(pad: number, param: 'volume' | 'pan' | 'pitch' | 'fx_send', value: number) {
	// Coalesce rapid changes (S13) — 300ms debounce to avoid stack bloat
	if (paramDebounceTimer !== null) {
		window.clearTimeout(paramDebounceTimer);
	}
	pendingParam = { pad, param, value };
	// Optimistically update UI without pushing undo for intermediate steps
	const preview = structuredClone(get(project));
	if (preview.kit.pads[pad]) {
		preview.kit.pads[pad][param] = value;
		project.set(preview);
		markDirty(true);
		refreshValidation(preview);
	}

	paramDebounceTimer = window.setTimeout(() => {
		paramDebounceTimer = null;
		if (!pendingParam) return;
		const { pad: ppad, param: pparam, value: pvalue } = pendingParam;
		pendingParam = null;
		const p = structuredClone(get(project));
		if (p.kit.pads[ppad]) {
			// Commit with undo snapshot (single entry for the burst)
			p.kit.pads[ppad][pparam] = pvalue;
			commit(p);
		}
	}, 300);
}

/**
 * Replaces the project's preferences block in one undoable change.
 *
 * @param prefs The new preferences object.
 */
export async function setPrefs(prefs: import('../lib/commands').Project['prefs']) {
	const p = structuredClone(get(project));
	p.prefs = prefs;
	commit(p);
}

// ---- recent ----
/** Reloads the recent-kits list from the backend, ignoring load failures. */
export function refreshRecent() {
	api
		.loadRecent()
		.then((s) => recentStore.set(s))
		.catch(() => {});
}

/**
 * Opens a recent kit after the shared unsaved-changes guard approves the switch.
 *
 * @param path Path of the recent kit to open.
 * @returns The loaded project, or `undefined` when the guard cancelled the action.
 */
export async function openRecent(path: string) {
	if (await guardUnsaved()) return openKit(path);
}

// ---- unsaved-changes guard (spec §14.2) ----
/**
 * Reports whether the project currently has unsaved changes, read synchronously
 * from a cached mirror of the dirty store.
 *
 * @returns `true` when there are unsaved changes.
 */
export function isDirty(): boolean {
	return dirtyCache;
}

let dirtyCache = false;
dirty.subscribe((v) => (dirtyCache = v));

type UnsavedChoice = 'save' | 'discard' | 'cancel' | null;
export const unsavedOpen = writable(false);
export const missingDialogOpen = writable(false);
export const stkInspectOpen = writable(false);
let unsavedResolver: ((c: UnsavedChoice) => void) | null = null;

/**
 * Opens the unsaved-changes dialog and resolves once the user picks an option.
 *
 * @returns A promise resolving to the user's choice (`'save'`, `'discard'`, `'cancel'`, or `null`).
 */
export function requestUnsavedDialog(): Promise<UnsavedChoice> {
	return new Promise((resolve) => {
		unsavedResolver = resolve;
		unsavedOpen.set(true);
	});
}

/**
 * Resolves the pending unsaved-changes dialog with the user's choice, closes the
 * dialog, and broadcasts a `confirmUnsaved` event for listeners.
 *
 * @param choice The user's decision (`'save'`, `'discard'`, `'cancel'`, or `null`).
 */
export function unsavedResolve(choice: UnsavedChoice): void {
	if (unsavedResolver) {
		unsavedResolver(choice);
		unsavedResolver = null;
		unsavedOpen.set(false);
	}
	if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('confirmUnsaved', { detail: choice }));
}

/**
 * Guards an action that would discard the current kit: returns immediately when
 * clean, otherwise prompts and either saves, discards, or cancels.
 *
 * @returns `true` when the caller may proceed, `false` when the user cancelled.
 */
export async function guardUnsaved(): Promise<boolean> {
	if (!dirtyCache) return true;
	const choice = await requestUnsavedDialog();
	if (choice === 'save') return (await saveKit()) !== null;
	if (choice === 'discard') {
		setSaved();
		return true;
	}
	return false;
}

// ---- exported for recent menu ----
/** Clears the entire recent-kits list in the backend. */
export async function clearRecent() {
	await api.clearRecent();
}

/**
 * Marks a recent-kit entry as having (or no longer having) unsaved changes.
 *
 * @param path Path of the recent entry to update.
 * @param unsaved Whether the entry should be flagged as unsaved.
 */
export async function setRecentUnsaved(path: string, unsaved: boolean) {
	await api.setRecentUnsaved(path, unsaved);
}
