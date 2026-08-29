// Global application store: project state, undo/redo, dirty detection,
// and recent kits.
import { writable, get } from 'svelte/store';
import {
  api,
  type Project,
  type RecentStore,
  type ValidationResult,
  type CompileReport,
  type ExportReport,
  type FindMissingReport,
  type Sample,
} from '../lib/commands';
import { success as notifySuccess, error as notifyError, warn as notifyWarn } from './notify';

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
  prefs: {} as Project['prefs'],
});

// ---- primary state ----
export const project = writable<Project>(newProject());
export const projectPath = writable<string | null>(null);
export const dirty = writable(false);
export const status = writable<KitStatus>({ id: 'saved', label: 'Saved', kind: 'saved' });
export const recentStore = writable<RecentStore>({ entries: [] });
export const validation = writable<ValidationResult>({ errors: [], warnings: [] });

function initialLocale(): 'fr' | 'en' {
	if (typeof localStorage !== 'undefined') {
		const v = localStorage.getItem('locale');
		if (v === 'fr' || v === 'en') return v;
	}
	if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr')) return 'fr';
	return 'en';
}
export const locale = writable<'fr' | 'en'>(initialLocale());
if (typeof localStorage !== 'undefined') {
	locale.subscribe((v) => localStorage.setItem('locale', v));
}

// ---- undo / redo ----
interface Snapshot {
  project: Project;
}
export const undoStack = writable<Snapshot[]>([]);
export const redoStack = writable<Snapshot[]>([]);

// ---- helpers (call these, do not mutate `project` directly) ----
export function markDirty(v = true) {
  if (v) {
    dirty.set(true);
    status.update((_s) => ({ id: 'modified', label: 'Modified', kind: 'modified' }));
  }
}

export function setSaved() {
  dirty.set(false);
  status.update((_s) => ({ id: 'saved', label: 'Saved', kind: 'saved' }));
}

// Push current snapshot to undo, then apply the new project.
export function commit(newProject: Project) {
  project.update((prev) => {
    undoStack.update((s) => [...s, { project: prev }].slice(-100));
    return newProject;
  });
  markDirty(true);
  refreshValidation(newProject);
}

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

export async function openKit(path: string) {
  status.update((_s) => ({ id: 'saving', label: 'Opening…', kind: 'saving' }));
  const p = await api.openProject(path);
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
      if (report.items.some((i) => i.found_path)) notifySuccess('Missing files auto-linked');
    }
  } catch {}
  return p;
}

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

export async function saveAs(p = get(project)): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const out = await save({
    defaultPath: `${p.kit.name || 'kit'}.json`,
    filters: [{ name: 'SmplTrek Kit', extensions: ['json'] }],
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
export async function compileKit(
  outputPath: string,
  mono = true,
  overwrite = false
): Promise<CompileReport | null> {
  const p = get(project);
  status.update((_s) => ({ id: 'compiling', label: 'Compiling…', kind: 'compiling' }));
  try {
    const report = await api.compile(p, outputPath, mono, overwrite);
    status.update((_s) => ({ id: 'compile_ok', label: 'Compilation succeeded', kind: 'compile_ok' }));
    p.compile = {
      last_compiled: new Date().toISOString(),
      output_path: report.output_path,
      target: 'smpltrek-3.2',
    };
    commit(p);
    if (report.warnings.length) notifyWarn(`${report.warnings.length} warnings`);
    notifySuccess(`${report.pads_filled} pads → ${report.bytes} B`);
    return report;
  } catch (e) {
    status.update((_s) => ({ id: 'compile_error', label: 'Compilation failed', kind: 'compile_error' }));
    notifyError(String(e));
    return null;
  }
}

export async function exportKit(
  baseDir: string,
  profile: 'hardware' | 'full',
  copySamples = true
): Promise<ExportReport | null> {
  const p = get(project);
  try {
    const report = await api.export(p, { base_dir: baseDir, profile, copy_samples: copySamples });
    notifySuccess(`Export: ${report.paths.length} files`);
    return report;
  } catch (e) {
    notifyError(String(e));
    return null;
  }
}

export async function findMissingGlobal(): Promise<FindMissingReport | null> {
  const p = get(project);
  const path = get(projectPath);
  try {
    const report = await api.findMissing(p, path ?? '');
    if (report.items.some((item) => item.resolved)) notifySuccess('Some missing files were re-linked');
    if (report.items.some((item) => !item.resolved)) notifyWarn('Some files could not be found');
    return report;
  } catch (e) {
    notifyError(String(e));
    return null;
  }
}

export async function relink(pad: number, newPath: string, keepOriginal = true) {
  const p = get(project);
  try {
    const updated = await api.relink(p, pad, newPath, keepOriginal);
    project.set(updated);
    markDirty(true);
    notifySuccess(`Pad ${pad} re-linked`);
    // Sync recent has_missing_files for current project
    const path = get(projectPath);
    if (path) {
      const stillMissing = Object.values(updated.kit.pads).some(
        (s) => s.file_name && !s.resolved_path
      );
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
  const v = await api.validate(p);
  validation.set(v);
}

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

export async function setKitName(name: string) {
  const p = structuredClone(get(project));
  p.kit.name = name;
  commit(p);
}

export async function setNotes(notes: string) {
  const p = structuredClone(get(project));
  p.kit.notes = notes;
  commit(p);
}

let paramDebounceTimer: number | null = null;
let pendingParam: { pad: number; param: 'volume' | 'pan' | 'pitch' | 'fx_send'; value: number } | null = null;

export async function setParam(
  pad: number,
  param: 'volume' | 'pan' | 'pitch' | 'fx_send',
  value: number
) {
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

export async function setPrefs(prefs: import('../lib/commands').Project['prefs']) {
  const p = structuredClone(get(project));
  p.prefs = prefs;
  commit(p);
}

// ---- recent ----
export function refreshRecent() {
  api.loadRecent().then((s) => recentStore.set(s)).catch(() => {});
}

export async function openRecent(path: string) {
  if (await guardUnsaved()) return openKit(path);
}

// ---- unsaved-changes guard (spec §14.2) ----
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

export function requestUnsavedDialog(): Promise<UnsavedChoice> {
  return new Promise((resolve) => {
    unsavedResolver = resolve;
    unsavedOpen.set(true);
  });
}

export function unsavedResolve(choice: UnsavedChoice): void {
  if (unsavedResolver) {
    unsavedResolver(choice);
    unsavedResolver = null;
    unsavedOpen.set(false);
  }
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('confirmUnsaved', { detail: choice }));
}

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
export async function clearRecent() {
  await api.clearRecent();
}

export async function setRecentUnsaved(path: string, unsaved: boolean) {
  await api.setRecentUnsaved(path, unsaved);
}