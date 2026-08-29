// Typed wrappers around the Tauri Rust commands.
import { invoke } from '@tauri-apps/api/core';

// ---- shared types (mirror src-tauri/src/models.rs) ----

export interface AudioMeta {
     duration_ms?: number;
      sample_rate?: number;
       bits?: number;
        channels?: number;
         byte_size?: number
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
                note?: string
}

export interface Device {
     profile: string;
      firmware: string
}

export interface Project {
     format: string;
      fmt_version: number;
       app_version: string;
        device: Device;
         kit: {
          name: string;
           pads: Record<number, Sample>;
            notes?: string
           };
          compile?: {
           last_compiled?: string;
            output_path?: string;
             target?: string
             };
            prefs?: {
             copy_samples?: boolean;
              sd_profile?: string
               }
}

export interface ValidationResult {
     errors: string[];
      warnings: string[]
}

export interface CompileReport {
     output_path: string;
      bytes: number;
       pads_filled: number;
        warnings: string[]
}

export interface ExportOptions {
     base_dir: string;
      profile: string;
       copy_samples?: boolean
}

export interface ExportReport {
     base_dir: string;
      paths: string[];
       note: string
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
              compatible: boolean;
               warning?: string;
                modified?: number
}

export interface RecentEntry {
     path: string;
      name: string;
       last_opened?: string;
        last_modified?: string;
         missing?: boolean;
          has_missing_files?: boolean;
           unsaved?: boolean
}

export interface RecentStore {
     entries: RecentEntry[]
}

export interface FindMissingItem {
     pad: number;
      file_name: string;
       original_path: string;
        resolved: boolean;
         found_path?: string
}

export interface FindMissingReport {
     items: FindMissingItem[]
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
                   max_kit_bytes?: number
}

export interface StkPadInfo {
     pad: number;
      path: string;
       volume: number;
        pan: number;
         pitch: number;
          fx_send: number;
           valid: boolean;
            warnings: string[]
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
               info: string[]
}

export interface ExtractedPad {
     pad: number;
      wav_file?: string | null;
       bytes: number;
        volume: number;
         pan: number;
          pitch: number;
           fx_send: number
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
             note: string
}

export interface Diagnostics {
     app_version: string;
      os: string;
       cpu: string;
        arch: string;
         ram_bytes: number
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
      note: sample.note,
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
      note: sample.note,
    };
  }
  return { ...project, kit: { ...project.kit, pads } };
}

// ---- commands ----

export const api = {
  openProject: (path: string) =>
    invoke<BackendProject>('cmd_open_project', { path }).then(fromBackendProject),
  saveProject: (path: string, project: Project) =>
    invoke('cmd_save_project', { path, project: toBackendProject(project) }),
  validate: (project: Project) =>
    invoke<ValidationResult>('cmd_validate', { project: toBackendProject(project) }),
  getProfile: (profile: string, firmware: string, kitTitle: string) =>
    invoke<DeviceProfileInfo>('cmd_get_profile', { profile, firmware, kitTitle }),
  loadRecent: () => invoke<RecentStore>('cmd_load_recent'),
  touchRecent: (path: string, name: string) =>
    invoke<RecentStore>('cmd_touch_recent', { path, name }),
  clearRecent: () => invoke('cmd_clear_recent'),
  removeRecent: (path: string) =>
    invoke<RecentStore>('cmd_remove_recent', { path }),
  setRecentUnsaved: (path: string, unsaved: boolean) =>
    invoke<RecentStore>('cmd_set_recent_unsaved', { path, unsaved }),
  inspectStk: (path: string, locale: string) =>
    invoke<StkInspectReport>('cmd_inspect_stk', { path, locale }),
  extractStk: (path: string, destDir: string, kitName: string | null, locale: string) =>
    invoke<StkExtractReport>('cmd_extract_stk', { path, destDir, kitName, locale }),
  diagnostics: () =>
    invoke<Record<string, unknown>>('cmd_diagnostics').then((d) => ({
      app_version: String(d.appVersion ?? ''),
      os: String(d.os ?? ''),
      cpu: String(d.cpu ?? ''),
      arch: String(d.arch ?? ''),
      ram_bytes: Number(d.ramBytes ?? 0),
    }) as Diagnostics),
  findMissing: (project: Project, projectPath: string) =>
    invoke<FindMissingReport>('cmd_find_missing', { project: toBackendProject(project), projectPath }),
  relink: (project: Project, pad: number, newPath: string, keepOriginal: boolean) =>
    invoke<BackendProject>('cmd_relink', { project: toBackendProject(project), pad, newPath, keepOriginal }).then(fromBackendProject),
  searchCandidates: (fileName: string, basePath: string, sha256?: string | null) =>
    invoke<string[]>('cmd_search_candidates', { fileName, basePath, sha256 }),
  compile: (project: Project, outputPath: string, mono: boolean, overwrite: boolean) =>
    invoke<CompileReport>('cmd_compile', { project: toBackendProject(project), outputPath, mono, overwrite }),
  export: (project: Project, opts: ExportOptions) =>
    invoke<ExportReport>('cmd_export', { project: toBackendProject(project), opts }),
  listWavs: (dir: string) => invoke<AudioFile[]>('cmd_list_wavs', { dir }),
  audioMeta: (path: string) => invoke<AudioFile>('cmd_audio_meta', { path }),
  exitApp: () => invoke<void>('cmd_exit_app')
};

export const inspectStk = (path: string, locale: string) =>
     invoke<StkInspectReport>('cmd_inspect_stk', { path, locale });

export const extractStk = (
     path: string,
     destDir: string,
     kitName: string | null,
     locale: string
) => invoke<StkExtractReport>('cmd_extract_stk', { path, destDir, kitName, locale });

export const diagnostics = () => api.diagnostics();
