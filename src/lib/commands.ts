// Typed wrappers around the Tauri Rust commands.
import { invoke } from '@tauri-apps/api/core';

// ---- shared types (mirror src-tauri/src/models.rs) ----

export interface AudioMeta {
	duration_ms?: number;
	sample_rate?: number;
	bits?: number;
	channels?: number;
	byte_size?: number;
}

export interface Sample {
	id: string;
	file_name: string;
	original_file_name?: string;
	resolved_path?: string;
	original_path: string;
	sha256?: string;
	meta?: AudioMeta;
	volume: number;
	pan: number;
	pitch: number;
	fx_send: number;
	note?: string;
}

export interface Device {
	profile: string;
	firmware: string;
}

export interface Project {
	format: string;
	fmt_version: number;
	app_version: string;
	device: Device;
	kit: {
		name: string;
		pads: Record<number, Sample>;
		notes?: string;
	};
	compile?: {
		last_compiled?: string;
		output_path?: string;
		target?: string;
	};
	prefs?: {
		copy_samples?: boolean;
		sd_profile?: string;
	};
}

export interface ValidationResult {
	errors: string[];
	warnings: string[];
}

export interface CompileReport {
	output_path: string;
	bytes: number;
	pads_filled: number;
	warnings: string[];
}

export interface ExportOptions {
	base_dir: string;
	profile: string;
	copy_samples?: boolean;
}

export interface ExportReport {
	base_dir: string;
	paths: string[];
	note: string;
}

export interface AudioFile {
	name: string;
	path: string;
	ext: string;
	size: number;
	durationMs: number;
	sampleRate: number;
	channels: number;
	bits: number;
	/**
	 * Read-analysis compatibility with the SmplTrek target format:
	 * - `ready`: already 48 kHz / 16-bit, copied untouched on compile
	 * - `convertible`: readable but a different format, converted on compile
	 * - `unreadable`: cannot be decoded (corrupt, compressed, non-PCM)
	 */
	status: WavStatus;
	warning?: string;
	modified?: number;
}

/** The three read-analysis states a WAV can have (see {@link AudioFile.status}). */
export type WavStatus = 'ready' | 'convertible' | 'unreadable';

/** A pad whose assigned WAV could not be compiled (from a refused compile). */
export interface UnreadablePad {
	pad: number;
	fileName: string;
	reason: string;
}

/**
 * Sentinel prefix the Rust `cmd_compile` puts on its error string when it
 * refused the build only because some pads are unreadable and `skipUnreadable`
 * was false. The remainder is a JSON array of {@link UnreadablePad}.
 */
export const UNREADABLE_PADS_PREFIX = 'UNREADABLE_PADS:';

/**
 * If `err` is a refused-compile error listing unreadable pads, return the parsed
 * pad list; otherwise return `null` (a real error the caller should surface).
 *
 * @param err The error thrown by {@link api.compile}.
 */
export function parseUnreadablePads(err: unknown): UnreadablePad[] | null {
	const msg = String(err);
	const at = msg.indexOf(UNREADABLE_PADS_PREFIX);
	if (at === -1) return null;
	try {
		const json = msg.slice(at + UNREADABLE_PADS_PREFIX.length);
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) ? (parsed as UnreadablePad[]) : null;
	} catch {
		return null;
	}
}

export interface RecentEntry {
	path: string;
	name: string;
	last_opened?: string;
	last_modified?: string;
	missing?: boolean;
	has_missing_files?: boolean;
	unsaved?: boolean;
}

export interface RecentStore {
	entries: RecentEntry[];
}

export interface FindMissingItem {
	pad: number;
	file_name: string;
	original_path: string;
	resolved: boolean;
	found_path?: string;
}

export interface FindMissingReport {
	items: FindMissingItem[];
}

export interface DeviceProfileInfo {
	id: string;
	firmware: string;
	name: string;
	pad_count: number;
	active_pads: number[];
	special_pads: number[];
	internal_audio_root: string;
	max_internal_path_bytes: number;
	min_kit_name_len: number;
	max_kit_name_len: number;
	sd_root_folders: string[];
	sd_hardware_folders: string[];
	max_sample_bytes: number;
	max_kit_bytes?: number;
}

export interface StkPadInfo {
	pad: number;
	path: string;
	volume: number;
	pan: number;
	pitch: number;
	fx_send: number;
	valid: boolean;
	warnings: string[];
}

export interface StkInspectReport {
	path: string;
	valid: boolean;
	bytes: number;
	header_ok: boolean;
	ktdt_ok: boolean;
	pads_total: number;
	pads_filled: number;
	pads: StkPadInfo[];
	errors: string[];
	warnings: string[];
	info: string[];
}

export interface ExtractedPad {
	pad: number;
	wav_file?: string | null;
	bytes: number;
	volume: number;
	pan: number;
	pitch: number;
	fx_send: number;
}

export interface StkExtractReport {
	source: string;
	source_sha256: string;
	dest_dir: string;
	json_path: string;
	manifest_path: string;
	kit_name: string;
	wavs_written: number;
	pads: ExtractedPad[];
	note: string;
}

export interface Diagnostics {
	app_version: string;
	os: string;
	cpu: string;
	arch: string;
	ram_bytes: number;
}

export interface SdPresetCounts {
	audio_drum: number;
	audio_inst: number;
	kit: number;
}

export interface SdAudioFile {
	relative_path: string;
	bytes: number;
	source_group: string;
}

export interface SdCardReport {
	selected_path: string;
	smpltrek_path?: string | null;
	valid: boolean;
	missing_directories: string[];
	projects: string[];
	presets: SdPresetCounts;
	audio_files: SdAudioFile[];
}

interface BackendSdPresetCounts {
	audioDrum: number;
	audioInst: number;
	kit: number;
}

interface BackendSdAudioFile {
	relativePath: string;
	bytes: number;
	sourceGroup: string;
}

interface BackendSdCardReport {
	selectedPath: string;
	smpltrekPath?: string | null;
	valid: boolean;
	missingDirectories: string[];
	projects: string[];
	presets: BackendSdPresetCounts;
	audioFiles: BackendSdAudioFile[];
}

interface BackendSample {
	id: string;
	fileName: string;
	originalFileName?: string;
	resolvedPath?: string;
	originalPath: string;
	sha256?: string;
	meta?: AudioMeta;
	volume: number;
	pan: number;
	pitch: number;
	fxSend: number;
	note?: string;
}

interface BackendProject extends Omit<Project, 'kit'> {
	kit: Omit<Project['kit'], 'pads'> & { pads: Record<number, BackendSample> };
}

/** Converts the UI's snake_case sample model to Rust's serde camelCase contract. */
function toBackendProject(project: Project): BackendProject {
	const pads: Record<number, BackendSample> = {};
	for (const [pad, sample] of Object.entries(project.kit.pads)) {
		pads[Number(pad)] = {
			id: sample.id,
			fileName: sample.file_name,
			originalFileName: sample.original_file_name,
			resolvedPath: sample.resolved_path,
			originalPath: sample.original_path,
			sha256: sample.sha256,
			meta: sample.meta,
			volume: sample.volume,
			pan: sample.pan,
			pitch: sample.pitch,
			fxSend: sample.fx_send,
			note: sample.note
		};
	}
	return { ...project, kit: { ...project.kit, pads } };
}

/** Converts Rust's serde camelCase sample fields back to the UI's snake_case model. */
function fromBackendProject(project: BackendProject): Project {
	const pads: Record<number, Sample> = {};
	for (const [pad, sample] of Object.entries(project.kit.pads)) {
		pads[Number(pad)] = {
			id: sample.id,
			file_name: sample.fileName,
			original_file_name: sample.originalFileName,
			resolved_path: sample.resolvedPath,
			original_path: sample.originalPath,
			sha256: sample.sha256,
			meta: sample.meta,
			volume: sample.volume,
			pan: sample.pan,
			pitch: sample.pitch,
			fx_send: sample.fxSend,
			note: sample.note
		};
	}
	return { ...project, kit: { ...project.kit, pads } };
}

/** Converts Rust's serde camelCase SD-card report back to the UI's snake_case model. */
function fromBackendSdCardReport(report: BackendSdCardReport): SdCardReport {
	return {
		selected_path: report.selectedPath,
		smpltrek_path: report.smpltrekPath,
		valid: report.valid,
		missing_directories: report.missingDirectories,
		projects: report.projects,
		presets: {
			audio_drum: report.presets.audioDrum,
			audio_inst: report.presets.audioInst,
			kit: report.presets.kit
		},
		audio_files: report.audioFiles.map((file) => ({
			relative_path: file.relativePath,
			bytes: file.bytes,
			source_group: file.sourceGroup
		}))
	};
}

// ---- commands ----

/**
 * Typed façade over the Tauri Rust commands. Each method invokes one backend
 * command and translates between the UI's snake_case models and Rust's camelCase
 * serde contract where needed.
 */
export const api = {
	/** Opens a project file and returns it in the UI model. @param path Project file path. */
	openProject: (path: string) => invoke<BackendProject>('cmd_open_project', { path }).then(fromBackendProject),
	/** Saves a project to disk. @param path Destination path. @param project Project to save. */
	saveProject: (path: string, project: Project) =>
		invoke('cmd_save_project', { path, project: toBackendProject(project) }),
	/** Validates a project and returns its errors and warnings. @param project Project to validate. */
	validate: (project: Project) => invoke<ValidationResult>('cmd_validate', { project: toBackendProject(project) }),
	/** Returns device profile info. @param profile Profile id. @param firmware Firmware version. @param kitTitle Kit name for validation. */
	getProfile: (profile: string, firmware: string, kitTitle: string) =>
		invoke<DeviceProfileInfo>('cmd_get_profile', { profile, firmware, kitTitle }),
	/** Loads the persisted recent-kits list. */
	loadRecent: () => invoke<RecentStore>('cmd_load_recent'),
	/** Records a kit as recently opened. @param path Kit path. @param name Kit display name. */
	touchRecent: (path: string, name: string) => invoke<RecentStore>('cmd_touch_recent', { path, name }),
	/** Clears the entire recent-kits list. */
	clearRecent: () => invoke('cmd_clear_recent'),
	/** Removes one entry from the recent-kits list. @param path Kit path to remove. */
	removeRecent: (path: string) => invoke<RecentStore>('cmd_remove_recent', { path }),
	/** Flags a recent entry's unsaved state. @param path Kit path. @param unsaved Whether it has unsaved changes. */
	setRecentUnsaved: (path: string, unsaved: boolean) =>
		invoke<RecentStore>('cmd_set_recent_unsaved', { path, unsaved }),
	/** Inspects a compiled STK file. @param path STK file path. @param locale UI locale for messages. */
	inspectStk: (path: string, locale: string) => invoke<StkInspectReport>('cmd_inspect_stk', { path, locale }),
	/** Extracts a compiled STK into an editable project. @param path STK path. @param destDir Output directory. @param kitName Optional kit name override. @param locale UI locale for messages. */
	extractStk: (path: string, destDir: string, kitName: string | null, locale: string) =>
		invoke<StkExtractReport>('cmd_extract_stk', { path, destDir, kitName, locale }),
	/** Returns host diagnostics (app version, OS, CPU, arch, RAM) in the UI model. */
	diagnostics: () =>
		invoke<Record<string, unknown>>('cmd_diagnostics').then(
			(d) =>
				({
					app_version: String(d.appVersion ?? ''),
					os: String(d.os ?? ''),
					cpu: String(d.cpu ?? ''),
					arch: String(d.arch ?? ''),
					ram_bytes: Number(d.ramBytes ?? 0)
				}) as Diagnostics
		),
	/** Searches for missing sample files referenced by a project. @param project The project. @param projectPath Path used as a search anchor. */
	findMissing: (project: Project, projectPath: string) =>
		invoke<FindMissingReport>('cmd_find_missing', { project: toBackendProject(project), projectPath }),
	/** Re-links a pad to a new file. @param project The project. @param pad Pad number. @param newPath New file path. @param keepOriginal Whether to keep the original path. */
	relink: (project: Project, pad: number, newPath: string, keepOriginal: boolean) =>
		invoke<BackendProject>('cmd_relink', { project: toBackendProject(project), pad, newPath, keepOriginal }).then(
			fromBackendProject
		),
	/** Returns candidate replacement paths for a missing file. @param fileName File name to match. @param basePath Search root. @param sha256 Optional content hash to prefer exact matches. */
	searchCandidates: (fileName: string, basePath: string, sha256?: string | null) =>
		invoke<string[]>('cmd_search_candidates', { fileName, basePath, sha256 }),
	/** Compiles a project into a device STK file. @param project The project. @param outputPath Output STK path. @param mono Whether to render mono. @param overwrite Whether to overwrite an existing file. @param skipUnreadable When false, an unreadable pad refuses the compile and its pads are returned via an {@link UNREADABLE_PADS_PREFIX}-tagged error; when true, those pads compile as silence. */
	compile: (project: Project, outputPath: string, mono: boolean, overwrite: boolean, skipUnreadable = false) =>
		invoke<CompileReport>('cmd_compile', {
			project: toBackendProject(project),
			outputPath,
			mono,
			overwrite,
			skipUnreadable
		}),
	/** Exports a project to a directory. @param project The project. @param opts Export options (base dir, profile, copy flag). */
	export: (project: Project, opts: ExportOptions) =>
		invoke<ExportReport>('cmd_export', { project: toBackendProject(project), opts }),
	/** Lists WAV files in a directory. @param dir Directory to scan. */
	listWavs: (dir: string) => invoke<AudioFile[]>('cmd_list_wavs', { dir }),
	/** Reads audio metadata for a single file. @param path Audio file path. */
	audioMeta: (path: string) => invoke<AudioFile>('cmd_audio_meta', { path }),
	/** Inspects an SD card layout and returns its report in the UI model. @param selectedPath SD card root path. */
	inspectSdCard: (selectedPath: string) =>
		invoke<BackendSdCardReport>('cmd_inspect_sd_card', { selectedPath }).then(fromBackendSdCardReport),
	/** Requests a native process exit through the Rust side. */
	exitApp: () => invoke<void>('cmd_exit_app')
};

/**
 * Inspects a compiled STK file without going through the {@link api} object.
 *
 * @param path STK file path.
 * @param locale UI locale for localized report messages.
 * @returns The inspection report.
 */
export const inspectStk = (path: string, locale: string) =>
	invoke<StkInspectReport>('cmd_inspect_stk', { path, locale });

/**
 * Extracts a compiled STK into an editable project directory.
 *
 * @param path STK file path.
 * @param destDir Directory to write the extracted project and WAVs into.
 * @param kitName Optional kit name override, or `null` to keep the embedded name.
 * @param locale UI locale for localized report messages.
 * @returns The extraction report.
 */
export const extractStk = (path: string, destDir: string, kitName: string | null, locale: string) =>
	invoke<StkExtractReport>('cmd_extract_stk', { path, destDir, kitName, locale });

/**
 * Returns host diagnostics via the {@link api} object.
 *
 * @returns App version, OS, CPU, architecture, and RAM size.
 */
export const diagnostics = () => api.diagnostics();
