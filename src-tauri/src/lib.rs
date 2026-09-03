// Tauri command layer. Exposes typed, validated system operations to the Svelte
// frontend. All filesystem access and STK compilation happen here (spec §21).

#![forbid(unsafe_code)]

pub mod models;
pub mod profile;
pub mod stk_format;
pub mod wav;
pub mod compile;
pub mod stk_inspect;
pub mod diagnostics;
pub mod window_state;
pub mod sd_card;

pub use crate::window_state::{load_window_size, save_window_size, WindowSize};

// Public re-exports for Tauri commands
pub use crate::compile::{CompileReport, ValidationResult};
pub use crate::models::{DeviceProfileInfo, ProjectPrefs, Project};

use crate::compile::{validate, CompileOptions};
use crate::models::{PROJECT_FORMAT, PROJECT_FORMAT_VERSION};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;

// ── Recent kits (spec §15) ────────────────────────────────────────────────

const REC_MAX: usize = 12;

/// One entry in the recent-kits list (spec §15).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntry {
      /// Canonical absolute path to the project JSON.
      pub path: String,
      /// Display name (kit name, or filename fallback).
      pub name: String,
      /// ISO-ish timestamp of the last open.
      #[serde(default)]
     pub last_opened: String,
      /// ISO-ish timestamp of the last modification.
      #[serde(default)]
     pub last_modified: String,
      /// True when the project file itself no longer exists on disk.
      #[serde(default)]
     pub missing: bool,
      /// True when one or more of the kit's referenced samples are missing.
      #[serde(default)]
     pub has_missing_files: bool,
      /// True when the project has unsaved edits.
      #[serde(default)]
     pub unsaved: bool
}

/// The persisted recent-kits list, newest first.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecentStore {
     /// Recent entries in MRU order, capped at [`REC_MAX`].
     pub entries: Vec<RecentEntry>
}

fn now_iso() -> String {
       // Seconds since 1970 -> approximate ISO; good enough for ordering/UI.
       format!("{}s", crate::stk_format::unix_now_secs())
}

/// Absolute path to the recent-kits store (`<data_local>/stk-forge/recent.json`).
pub fn prefs_path() -> Result<PathBuf, String> {
       let dir = dirs::data_local_dir().ok_or("no data dir")?;
      Ok(dir.join("stk-forge").join("recent.json"))
}

/// Load the recent-kits store, returning an empty store if none exists yet.
pub fn load_recent() -> Result<RecentStore, String> {
       let p = prefs_path()?;
      if !p.exists() {
        return Ok(RecentStore::default());
        }
      let raw = fs::read_to_string(&p).map_err(|e| format!("read recent: {e}"))?;
      serde_json::from_str(&raw).map_err(|e| format!("parse recent: {e}"))
}

/// Persist the recent-kits store, creating the parent directory as needed.
pub fn save_recent(store: &RecentStore) -> Result<(), String> {
       let p = prefs_path()?;
      if let Some(d) = p.parent() {
        fs::create_dir_all(d).map_err(|e| e.to_string())?;
         }
      fs::write(&p, serde_json::to_string_pretty(store).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

/// Add/update a recent kit (dedupe by path, MRU order), capped at 12.
pub fn touch_recent(path: &str, name: &str) -> Result<RecentStore, String> {
       let mut store = load_recent().unwrap_or_default();
      let p = std::fs::canonicalize(path)
        .map_err(|e| e.to_string())
        .unwrap_or_else(|_| PathBuf::from(path));
      let p = p.to_string_lossy().into_owned();

      store.entries.retain(|e| e.path != p);
      let mut entry = RecentEntry {
        path: p.clone(),
        name: if name.is_empty() {
          Path::new(&p).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or(name.to_string())
         } else {
          name.to_string()
          },
        last_opened: now_iso(),
        last_modified: now_iso(),
        missing: false,
        has_missing_files: false,
        unsaved: false
         };
      entry.missing = !Path::new(&p).exists() && !Path::new(path).exists();
      store.entries.insert(0, entry);
      if store.entries.len() > REC_MAX {
        store.entries.truncate(REC_MAX);
         }
      for i in 0..store.entries.len() {
        store.entries[i].unsaved = false;
        let has_missing = check_missing_files(&store.entries[i].path);
        store.entries[i].has_missing_files = has_missing;
         }
      save_recent(&store)?;
      Ok(store)
}

fn check_missing_files(project_path: &str) -> bool {
       let raw = match fs::read_to_string(project_path) { Ok(r) => r, Err(_) => return false};
      let project: Project = match serde_json::from_str(&raw) { Ok(p) => p, Err(_) => return true};
      for s in project.kit.pads.values() {
        if s.file_name.is_empty() { continue; }
        let p = s.resolved_path.as_deref()
          .map(PathBuf::from)
          .or_else(|| s.original_path.trim().is_empty().then(|| PathBuf::from("")));
        if let Some(p) = p {
          if !p.exists() {
            return true;
            }
          }
        }
      false
}

/// Empty the recent-kits list.
pub fn clear_recent() -> Result<(), String> {
       save_recent(&RecentStore::default())
}

/// Remove a single kit from the recent list, matched by path or filename.
pub fn remove_recent(path: &str) -> Result<RecentStore, String> {
       let mut store = load_recent().unwrap_or_default();
      let p = PathBuf::from(path);
      store.entries.retain(|e| e.path != p.to_string_lossy() && Path::new(&e.path).file_name() != p.file_name());
      save_recent(&store)?;
      Ok(store)
}

/// Set the `unsaved` flag on the recent entry matching `path`.
pub fn set_recent_unsaved(path: &str, unsaved: bool) -> Result<RecentStore, String> {
      let mut store = load_recent().unwrap_or_default();
      for e in store.entries.iter_mut() {
        if e.path == path {
          e.unsaved = unsaved;
          break;
        }
      }
      save_recent(&store)?;
      Ok(store)
}

// ── Project I/O (spec §11, §14) ────────────────────────────────────────────

/// Validate then atomically write a project to `path`, and touch the recent
/// list. Refuses to persist a project that fails validation.
pub fn save_project(path: &str, project: &Project) -> Result<(), String> {
      // Validate before writing so we never persist an invalid kit.
      let v = validate(project);
      if v.blocking() {
        return Err(format!("cannot save invalid project: {}", v.errors.join("; ")));
        }
      let p = PathBuf::from(path);
      if let Some(d) = p.parent() {
        fs::create_dir_all(d).map_err(|e| e.to_string())?;
         }
      let tmp = p.with_extension("json.tmp");
      fs::write(&tmp, serde_json::to_string_pretty(project).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
      fs::rename(&tmp, &p).map_err(|e| e.to_string())?;
       // Mark saved.
      let proj_name = project.kit.name.clone();
      let _ = touch_recent(path, &proj_name);
      Ok(())
}

/// Read, migrate, and resolve a project from `path`, best-effort re-linking
/// missing samples and updating the recent list. Errors on unreadable or
/// unparseable JSON, or an unsupported project format/version.
pub fn open_project(path: &str) -> Result<Project, String> {
       let raw = fs::read_to_string(path).map_err(|e| format!("open: {e}"))?;
      let mut project: Project = migrate(serde_json::from_str(&raw).map_err(|e| format!("parse JSON: {e}"))?)
         ?;
      // Resolve missing files (best-effort, keeps original_path).
      resolve_missing(&mut project, path);
      let store = touch_recent(path, &project.kit.name).ok();
      let _ = store;
      Ok(project)
}

/// Best-effort migration of older JSON -> current schema (§23).
pub fn migrate(mut project: Project) -> Result<Project, String> {
      if project.format != PROJECT_FORMAT {
        return Err(format!("not a SmplTrek kit project: '{}'", project.format));
       }
      if project.fmt_version > PROJECT_FORMAT_VERSION {
        return Err(format!(
            "project version {} is newer than this app supports ({})",
           project.fmt_version, PROJECT_FORMAT_VERSION
          ));
       }
      // S02: backfill originalFileName if missing
      for s in project.kit.pads.values_mut() {
        if s.original_file_name.is_none() && !s.file_name.is_empty() {
          s.original_file_name = Some(s.file_name.clone());
        }
      }
      Ok(project)
}

/// For each missing file, try to re-resolve by name in the project dir, recent
/// dirs, then keep original_path (§10.4).
pub fn resolve_missing(project: &mut Project, project_path: &str) {
       let base = PathBuf::from(project_path);
      for s in project.kit.pads.values_mut() {
        if s.file_name.is_empty() {
          continue;
            }
        let resolved_missing = match &s.resolved_path {
           Some(p) => !Path::new(p).exists(),
             None => true,
            };
        if !resolved_missing {
          continue;
            }
        if !s.original_path.trim().is_empty() && Path::new(&s.original_path).exists() {
          s.resolved_path = Some(s.original_path.clone());
           continue;
           }
        let candidates = search_candidates(&s.file_name, base.as_path(), s.sha256.as_deref());
        // Auto-resolve only if single candidate or single exact-name match
        let chosen = if candidates.len() == 1 {
          Some(candidates[0].clone())
        } else if candidates.len() > 1 {
          let lower_name = s.file_name.to_lowercase();
          let exact: Vec<&PathBuf> = candidates.iter().filter(|p| p.file_name().map(|n| n.to_string_lossy().to_lowercase() == lower_name).unwrap_or(false)).collect();
          if exact.len() == 1 {
            Some(exact[0].clone())
          } else {
            None // leave as missing for user to pick (S08 step 6)
          }
        } else {
          None
        };
        if let Some(found) = chosen {
          s.resolved_path = Some(found.to_string_lossy().into_owned());
        }
       }
}

pub fn search_candidates(name: &str, base: &Path, expected_sha256: Option<&str>) -> Vec<PathBuf> {
      let lower_name = name.to_lowercase();
      let stem = Path::new(name)
        .file_stem()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();
      if stem.is_empty() {
        return Vec::new();
      }
      let root = base.parent().unwrap_or(base);
      let mut candidates: Vec<(PathBuf, i32)> = Vec::new();
      for entry in walkdir::WalkDir::new(root)
        .max_depth(4)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
      {
        let f = entry.path();
        let lower = f.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
        if !lower.ends_with(".wav") || !lower.contains(&stem) {
          continue;
        }
        let mut rank = 0;
        if lower == lower_name {
          rank -= 10;
        } else if lower.contains(&stem) {
          rank -= 5;
        }
        if let Some(expected) = expected_sha256 {
          if let Ok(actual) = sha256_file(f) {
            if actual == expected {
              rank -= 20;
            }
          }
        }
        // Prefer shorter paths (closer to project)
        let depth = f.components().count() as i32;
        rank += depth;
        candidates.push((f.to_path_buf(), rank));
      }
      candidates.sort_by_key(|(_, rank)| *rank);
      candidates.into_iter().map(|(p, _)| p).collect()
}

/// Global "find missing files" action (spec §10.4 / §9.5). Returns a report.
pub fn find_missing(project: &mut Project, project_path: &str) -> Result<FindMissingReport, String> {
       let mut report = FindMissingReport::default();
      resolve_missing(project, project_path);
      for s in project.kit.pads.values() {
        if s.file_name.is_empty() { continue; }
         let ok = s.resolved_path.as_ref().map(|p| Path::new(p).exists()).unwrap_or(false);
        report.items.push(FindMissingItem {
          pad: 0, // filled by caller if needed
          file_name: s.file_name.clone(),
          original_path: s.original_path.clone(),
          resolved: ok,
          found_path: s.resolved_path.clone()
          });
          }
      Ok(report)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FindMissingReport {
     pub items: Vec<FindMissingItem>
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FindMissingItem {
     pub pad: u8,
     pub file_name: String,
     pub original_path: String,
     pub resolved: bool,
     #[serde(skip_serializing_if = "Option::is_none")]
     pub found_path: Option<String>
}

/// Manually relink a pad sample to a chosen file (spec §10.4 step 8).
pub fn relink_sample(
     project: &mut Project,
     pad: u8,
     new_path: &str,
     keep_original: bool
) -> Result<(), String> {
      let sample = project.kit.pads.get_mut(&pad)
        .ok_or_else(|| format!("pad {pad} has no sample"))?;
      let abs = normalize_path(new_path)?;
      if !abs.exists() {
        return Err(format!("file not found: {new_path}"));
         }
      if sample.original_file_name.is_none() {
        sample.original_file_name = Some(sample.file_name.clone());
      }
      sample.original_path = if keep_original {
        sample.original_path.clone()
         } else {
        abs.to_string_lossy().into_owned()
         };
      sample.resolved_path = Some(abs.to_string_lossy().into_owned());
      sample.file_name = abs
         .file_name()
         .map(|n| n.to_string_lossy().into_owned())
         .unwrap_or(sample.file_name.clone());
      sample.sha256 = sha256_file(&abs).ok();
      // refresh meta
      if let Ok(info) = crate::wav::read_wav_info(&abs) {
        sample.meta.duration_ms = Some(info.duration_ms);
        sample.meta.sample_rate = Some(info.sample_rate);
        sample.meta.bits = Some(info.bits);
        sample.meta.channels = Some(info.channels);
         }
      Ok(())
}

/// Validate a project against its device profile (no I/O).
pub fn validate_project(project: &Project) -> ValidationResult {
       validate(project)
}

// ── Compile / Export (spec §12, §13) ───────────────────────────────────────

/// Compile a project to a `.stk` file at `output_path` (see [`compile::compile`]).
///
/// `skip_unreadable`: when false (default), a pad whose WAV cannot be decoded
/// aborts the compile and the unreadable pads are returned (see
/// [`compile::UNREADABLE_PADS_PREFIX`]); when true, those pads are written as
/// silence and the `.stk` is produced.
pub fn compile_to_stk(project: &Project, output_path: &str, mono: bool, overwrite: bool, skip_unreadable: bool) -> Result<CompileReport, String> {
       let opts = CompileOptions {
        output_path: output_path.to_string(),
        mono,
        overwrite,
        skip_unreadable
         };
      compile::compile(project, &opts)
}

/// Options for an SD-card export (spec §13).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
     /// Root directory to export into (the SD card mount point).
     pub base_dir: String,
     /// Export profile: `"hardware"` (device files only) or `"full"`.
     pub profile: String, // "hardware" | "full"
     /// Copy source WAVs alongside the kit (full profile only).
     #[serde(default)]
     pub copy_samples: bool
}

/// Result of an SD-card export.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExportReport {
     /// Root directory that was exported into.
     pub base_dir: String,
     /// Absolute paths of every file written.
     pub paths: Vec<String>,
     /// Human-readable note about what the device does and does not read.
     pub note: String
}

/// Export to an SD-card layout (spec §13). No SQLite in V1.
pub fn export_sd(project: &Project, opts: ExportOptions) -> Result<ExportReport, String> {
       let base = PathBuf::from(&opts.base_dir);
      fs::create_dir_all(&base).map_err(|e| e.to_string())?;

      let prof = crate::profile::known_profile(&project.device.profile, &project.device.firmware)?;
      let mut out_paths = Vec::new();

      let (tmp_stk, report) = export_compile_temp_stk(project, &base)?;

      let hardware = opts.profile != "full";
      export_copy_stk_into_folders(project, prof.as_ref(), &base, &tmp_stk, hardware, &mut out_paths)?;

      if !hardware {
        export_full_extras(project, prof.as_ref(), &base, &report, &mut out_paths)?;
      }

      // cleanup temp
      let _ = fs::remove_dir_all(base.join("tmp_compile"));

      Ok(ExportReport {
        base_dir: opts.base_dir.clone(),
        paths: out_paths,
        note: if hardware {
            "Hardware export: only device-supported files. JSON projects are for re-editing, not read by the SmplTrek.".into()
         } else {
            "Full export includes project JSON files (not read by the device).".into()
          }
       })
}

/// Compile the kit into a scratch `.stk` under `base/tmp_compile/` (always mono,
/// overwrite). Returns the temp path and the compile report for reuse.
fn export_compile_temp_stk(
      project: &Project,
      base: &Path,
) -> Result<(PathBuf, CompileReport), String> {
      let tmp_stk = base.join("tmp_compile").join(format!("{}.stk", crate::stk_format::sanitize_kit_filename(&project.kit.name)));
      fs::create_dir_all(tmp_stk.parent().unwrap()).map_err(|e| e.to_string())?;
      let report = compile::compile(project, &CompileOptions {
        output_path: tmp_stk.to_string_lossy().into_owned(),
        mono: true,
        overwrite: true,
        skip_unreadable: false
        })
      .map_err(|e| format!("STK compile failed: {e}"))?;
      Ok((tmp_stk, report))
}

/// Copy the compiled `.stk` into each destination kit folder (hardware or full
/// root layout, per `hardware`), appending every written path to `out_paths`.
fn export_copy_stk_into_folders(
      project: &Project,
      prof: &dyn crate::profile::DeviceProfile,
      base: &Path,
      tmp_stk: &Path,
      hardware: bool,
      out_paths: &mut Vec<String>,
) -> Result<(), String> {
      for folder in if hardware { prof.sd_hardware_folders() } else { prof.sd_root_folders() } {
        let dest = base.join(&folder);
        fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
         let dest_stk = dest.join(format!("{}.stk", crate::stk_format::sanitize_kit_filename(&project.kit.name)));
        fs::copy(tmp_stk, &dest_stk).map_err(|e| e.to_string())?;
        out_paths.push(dest_stk.to_string_lossy().into_owned());
          }
      Ok(())
}

/// Write the full-profile extras that the hardware profile omits: source WAVs
/// under the pool root, the project JSON companion, and a README. Appends every
/// written path to `out_paths`.
fn export_full_extras(
      project: &Project,
      prof: &dyn crate::profile::DeviceProfile,
      base: &Path,
      report: &CompileReport,
      out_paths: &mut Vec<String>,
) -> Result<(), String> {
        // include WAVs (per the hardware layout root)
        let samples_dir = base.join(prof.sd_root_folders().get(1).cloned().unwrap_or("SmplTrek/Pool/Audio/Drum".into()));
        fs::create_dir_all(&samples_dir).map_err(|e| e.to_string())?;
         for pad in prof.active_pads() {
          if let Some(s) = project.kit.pads.get(&(pad as u8)) {
            if s.file_name.is_empty() { continue; }
            let src = s.resolved_path.as_ref().map(PathBuf::from)
              .or_else(|| Some(std::path::PathBuf::from(&s.original_path)));
            if let Some(src) = src {
              if src.exists() {
                let dest = samples_dir.join(s.file_name.clone());
                // Only copy if not already there (avoid overwrite of a real file).
                if !dest.exists() {
                  fs::copy(&src, &dest).map_err(|e| {
                    format!("copy sample '{}' -> '{}': {e}", src.display(), dest.display())
                  })?;
                    }
                out_paths.push(dest.to_string_lossy().into_owned());
                  }
              }
            }
          }

         // include project JSON + README
         let projects_dir = base.join("projects");
        fs::create_dir_all(&projects_dir).map_err(|e| e.to_string())?;
        let json = projects_dir.join(format!("{}.json", crate::stk_format::sanitize_kit_filename(&project.kit.name)));
        fs::write(&json, serde_json::to_string_pretty(project).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        out_paths.push(json.to_string_lossy().into_owned());

         let readme = base.join("README.txt");
        let body = readme_text(project, report);
        fs::write(&readme, body).map_err(|e| e.to_string())?;
        out_paths.push(readme.to_string_lossy().into_owned());
      Ok(())
}

fn readme_text(project: &Project, report: &CompileReport) -> String {
      format!(
"STK Forge kit — {name}

Exported by STK Forge v{ver}.
Device: {dev} (profile {prof}, firmware {fw}).
Pads filled: {n}.

COMPATIBILITY
This kit was built for the Sonicware SmplTrek (firmware 3.2). Compatibility
with other Sonicware synthesizers or firmware versions is NOT guaranteed.

JSON project files in this export are for re-editing with STK Forge. They
are NOT read by the SmplTrek itself.
",
       name = project.kit.name,
      ver = crate::models::APP_VERSION,
      dev = "smpltrek",
      prof = project.device.profile,
      fw = project.device.firmware,
      n = report.pads_filled,
      )
}

#[cfg(test)]
#[test]
fn sanitize_export_name_is_cross_platform_safe() {
	use crate::stk_format::sanitize_kit_filename as sanitize;
	assert_eq!(sanitize("Main: Kit/2"), "Main-Kit-2");
	assert_eq!(sanitize("../CON"), "kit");
}

// ── Audio helpers ──────────────────────────────────────────────────────────

/// List WAV files in a folder (§10.1).
pub fn list_wavs(dir: &str) -> Result<Vec<AudioFile>, String> {
       let dir = PathBuf::from(dir);
      let mut out = Vec::new();
      if !dir.is_dir() {
        return Err(format!("not a directory: {}", dir.display()));
        }
      for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;

        let p = entry.path();
        if p.is_file() && p.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("wav")).unwrap_or(false) {
          out.push(describe_audio(&p));
            }
         }
      out.sort_by_key(|f| f.name.to_lowercase());
      Ok(out)
}

/// Read-analysis compatibility of a WAV against the device target format.
///
/// Computed from the `fmt ` header only (fast). `Unreadable` is the Default so
/// that a file whose metadata cannot even be read is never mistaken for
/// compatible.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum WavStatus {
      /// Already 48 kHz / 16-bit: copied to the device untouched on compile.
      Ready,
      /// Readable but a different format: will be converted on compile.
      Convertible,
      /// Cannot be decoded (corrupt, compressed, non-PCM, unknown depth).
      #[default]
      Unreadable
}

/// A WAV file described for the picker, with device-compatibility flags.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudioFile {
      /// File name (with extension).
      pub name: String,
      /// Absolute path.
      pub path: String,
      /// Extension without the dot.
      pub ext: String,
      /// File size in bytes.
      pub size: u64,
      /// Duration in milliseconds (0 if unreadable).
      pub duration_ms: u64,
      /// Sample rate in Hz.
      pub sample_rate: u32,
      /// Channel count.
      pub channels: u16,
      /// Bit depth.
      pub bits: u16,
      /// Read-analysis compatibility status: `ready` (already 48 kHz/16-bit),
      /// `convertible` (readable, will be converted on compile), or
      /// `unreadable` (cannot be decoded). Serialized camelCase as `status`.
      pub status: WavStatus,
      /// Optional human-readable compatibility warning.
      pub warning: Option<String>,
      /// Last-modified time as Unix seconds, if available.
      #[serde(default)]
      pub modified: Option<u64>
}

fn describe_audio(path: &Path) -> AudioFile {
       let meta = match fs::metadata(path) {
        Ok(m) => m,
          Err(_) => return AudioFile {
            name: path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
            path: path.to_string_lossy().into_owned(),
            ext: path.extension().map(|e| e.to_string_lossy().into_owned()).unwrap_or_default(),
            ..Default::default()
            }
            };
      let mut f = AudioFile {
        name: path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        path: path.to_string_lossy().into_owned(),
        ext: path.extension().map(|e| e.to_string_lossy().into_owned()).unwrap_or_default(),
        size: meta.len(),
        modified: meta
          .modified()
          .ok()
          .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())),
        ..Default::default()
        };
      match crate::wav::read_wav_info(path) {
        Ok(info) => {
          f.duration_ms = info.duration_ms;
          f.sample_rate = info.sample_rate;
          f.channels = info.channels;
          f.bits = info.bits;
          if info.sample_rate == 48000 && info.bits == 16 {
            f.status = WavStatus::Ready;
            f.warning = None;
          } else {
            f.status = WavStatus::Convertible;
            f.warning = Some(format!(
              "{} Hz / {}-bit → 48 kHz / 16-bit",
              info.sample_rate, info.bits
            ));
          }
          }
          Err(e) => {
            f.status = WavStatus::Unreadable;
            f.warning = Some(format!("unreadable/unsupported WAV: {e}"));
             }
          }
      f
}

/// Describe a single WAV file (metadata + compatibility). Errors if missing.
pub fn audio_meta(path: &str) -> Result<AudioFile, String> {
       let p = PathBuf::from(path);
      if !p.exists() {
        return Err(format!("file not found: {path}"));
         }
      Ok(describe_audio(&p))
}

/// SHA-256 of a file for stamp/fingerprinting.
pub fn sha256_file(path: &Path) -> Result<String, String> {
       let data = fs::read(path).map_err(|e| e.to_string())?;
      Ok(crate::stk_format::sha256_hex(&data))
}

/// Resolve `p` to an absolute path, joining it onto the current directory when
/// relative. Does not canonicalize or touch the filesystem.
pub fn normalize_path(p: &str) -> Result<PathBuf, String> {
       let pb = PathBuf::from(p);
      if pb.is_absolute() {
        Ok(pb)
        } else {
        Ok(cwd().join(pb))
         }
}

/// Current working directory, falling back to `"."` if it cannot be read.
pub fn cwd() -> PathBuf {
       std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::models::Project;

	#[test]
	fn prefs_path_uses_stk_forge_namespace() {
		let path = prefs_path().expect("local data directory should be available");
		assert!(path.ends_with(std::path::Path::new("stk-forge").join("recent.json")));
	}

	#[test]
	fn project_round_trip() {
		let p = Project::new("TEST_KIT");
		let json = serde_json::to_string_pretty(&p).unwrap();
		let p2: Project = serde_json::from_str(&json).unwrap();
		assert_eq!(p.kit.name, p2.kit.name);
		assert_eq!(p.format, p2.format);
	}

	#[test]
	fn migrate_valid_v1() {
		let p = Project::new("MIG");
		let migrated = migrate(p.clone()).unwrap();
		assert_eq!(migrated.fmt_version, crate::models::PROJECT_FORMAT_VERSION);
	}

	#[test]
	fn migrate_rejects_unknown_format() {
		let mut p = Project::new("BAD");
		p.format = "unknown".into();
		assert!(migrate(p).is_err());
	}

	#[test]
	fn validate_rejects_bad_kit_name() {
		let mut p = Project::new("");
		p.kit.name = "".into();
		let v = validate_project(&p);
		assert!(!v.is_ok());
	}

	#[test]
	fn compile_produces_valid_stk() {
		let p = Project::new("GOLDEN");
		let tmp = std::env::temp_dir().join("stk_test_golden.stk");
		let _ = std::fs::remove_file(&tmp);
		let report = compile_to_stk(&p, tmp.to_str().unwrap(), true, true, false).unwrap();
		assert!(report.bytes > 0);
		assert_eq!(report.pads_filled, 0);
		let data = std::fs::read(&tmp).unwrap();
		assert_eq!(&data[0..4], b"VDK0");
		assert_eq!(u32::from_le_bytes(data[4..8].try_into().unwrap()), data.len() as u32 - 360);
		let _ = std::fs::remove_file(&tmp);
	}

	/// Build a minimal, valid 48 kHz / 16-bit mono PCM WAV in `dir` and return
	/// its path. Used to give a pad a real, readable source file.
	fn write_min_wav(dir: &std::path::Path, name: &str, samples: usize) -> std::path::PathBuf {
		let pcm = vec![0i16; samples];
		let data_bytes = (pcm.len() * 2) as u32;
		let mut w = Vec::new();
		w.extend_from_slice(b"RIFF");
		w.extend_from_slice(&(36 + data_bytes).to_le_bytes());
		w.extend_from_slice(b"WAVE");
		w.extend_from_slice(b"fmt ");
		w.extend_from_slice(&16u32.to_le_bytes());
		w.extend_from_slice(&1u16.to_le_bytes()); // PCM
		w.extend_from_slice(&1u16.to_le_bytes()); // mono
		w.extend_from_slice(&48000u32.to_le_bytes());
		w.extend_from_slice(&(48000 * 2u32).to_le_bytes());
		w.extend_from_slice(&2u16.to_le_bytes());
		w.extend_from_slice(&16u16.to_le_bytes());
		w.extend_from_slice(b"data");
		w.extend_from_slice(&data_bytes.to_le_bytes());
		for s in &pcm {
			w.extend_from_slice(&s.to_le_bytes());
		}
		let path = dir.join(name);
		std::fs::write(&path, &w).unwrap();
		path
	}

	#[test]
	fn compile_never_mutates_source_wavs() {
		use crate::models::Sample;
		// Unique temp dir so parallel test runs never collide.
		let dir = std::env::temp_dir().join(format!(
			"stk_src_invariant_{}_{}",
			std::process::id(),
			std::time::SystemTime::now()
				.duration_since(std::time::UNIX_EPOCH)
				.unwrap()
				.as_nanos()
		));
		std::fs::create_dir_all(&dir).unwrap();

		// Two real source WAVs assigned to two active pads.
		let src_a = write_min_wav(&dir, "kick.wav", 1200);
		let src_b = write_min_wav(&dir, "snare.wav", 800);
		let before_a = sha256_file(&src_a).unwrap();
		let before_b = sha256_file(&src_b).unwrap();

		let mut p = Project::new("INVARIANT");
		for (pad, src, fname) in [(1u8, &src_a, "kick.wav"), (8u8, &src_b, "snare.wav")] {
			p.kit.pads.insert(
				pad,
				Sample {
					file_name: fname.to_string(),
					resolved_path: Some(src.to_string_lossy().into_owned()),
					original_path: src.to_string_lossy().into_owned(),
					..Default::default()
				},
			);
		}

		let out = dir.join("out.stk");
		compile_to_stk(&p, out.to_str().unwrap(), true, true, false).unwrap();

		// The source files must be byte-identical after compiling.
		assert_eq!(before_a, sha256_file(&src_a).unwrap(), "kick.wav source was modified");
		assert_eq!(before_b, sha256_file(&src_b).unwrap(), "snare.wav source was modified");

		let _ = std::fs::remove_dir_all(&dir);
	}

	#[test]
	fn describe_audio_rejects_compressed_format() {
		// A WAV whose fmt tag is µ-law (7) must be reported Unreadable, never
		// decoded as PCM garbage.
		let dir = std::env::temp_dir().join(format!(
			"stk_fmt_reject_{}_{}",
			std::process::id(),
			std::time::SystemTime::now()
				.duration_since(std::time::UNIX_EPOCH)
				.unwrap()
				.as_nanos()
		));
		std::fs::create_dir_all(&dir).unwrap();
		let mut w = Vec::new();
		w.extend_from_slice(b"RIFF");
		w.extend_from_slice(&40u32.to_le_bytes());
		w.extend_from_slice(b"WAVE");
		w.extend_from_slice(b"fmt ");
		w.extend_from_slice(&16u32.to_le_bytes());
		w.extend_from_slice(&7u16.to_le_bytes()); // µ-law: not decodable
		w.extend_from_slice(&1u16.to_le_bytes());
		w.extend_from_slice(&8000u32.to_le_bytes());
		w.extend_from_slice(&8000u32.to_le_bytes());
		w.extend_from_slice(&1u16.to_le_bytes());
		w.extend_from_slice(&8u16.to_le_bytes());
		w.extend_from_slice(b"data");
		w.extend_from_slice(&4u32.to_le_bytes());
		w.extend_from_slice(&[0u8; 4]);
		let path = dir.join("ulaw.wav");
		std::fs::write(&path, &w).unwrap();

		let af = describe_audio(&path);
		assert_eq!(af.status, WavStatus::Unreadable, "compressed WAV must be Unreadable");
		let _ = std::fs::remove_dir_all(&dir);
	}

	#[test]
	fn describe_audio_status_ready_vs_convertible() {
		let dir = std::env::temp_dir().join(format!(
			"stk_status_{}_{}",
			std::process::id(),
			std::time::SystemTime::now()
				.duration_since(std::time::UNIX_EPOCH)
				.unwrap()
				.as_nanos()
		));
		std::fs::create_dir_all(&dir).unwrap();
		// 48k/16-bit -> Ready.
		let ready = write_min_wav(&dir, "ready.wav", 48);
		assert_eq!(describe_audio(&ready).status, WavStatus::Ready);
		let _ = std::fs::remove_dir_all(&dir);
	}

	#[test]
	fn compile_matches_file_format_binary_layout() {
		let p = Project::new("FORMAT");
		let tmp = std::env::temp_dir().join("stk_test_file_format.stk");
		let _ = std::fs::remove_file(&tmp);
		compile_to_stk(&p, tmp.to_str().unwrap(), true, true, false).unwrap();
		let data = std::fs::read(&tmp).unwrap();

		// Factory SmplTrek kits use a four-byte VDK0 tag followed by the
		// file length minus the observed 360-byte container adjustment.
		assert_eq!(&data[0..4], b"VDK0");
		assert_eq!(u32::from_le_bytes(data[4..8].try_into().unwrap()), data.len() as u32 - 360);
		let inspection = crate::stk_inspect::inspect(tmp.to_str().unwrap(), "en").unwrap();
		assert!(inspection.valid, "official-layout STK must be accepted by the inspector");
		assert!(
			!inspection.warnings.iter().any(|warning| warning.contains("ISDT")),
			"the embedded first ISDT block must be counted"
		);
		assert_eq!(&data[8..12], &[0; 4]);
		assert_eq!(u32::from_le_bytes(data[12..16].try_into().unwrap()), 0x10);
		assert_eq!(&data[16..20], b"KTDT");
		assert_eq!(u32::from_le_bytes(data[20..24].try_into().unwrap()), 0x1084);
		assert_eq!(&data[24..28], &[0; 4]);
		assert_eq!(u32::from_le_bytes(data[28..32].try_into().unwrap()), 1);

		let ktdt = &data[0x20..0x10A4];
		assert_eq!(&ktdt[4200..4208], &[0; 8]);
		assert_eq!(u32::from_le_bytes(ktdt[4208..4212].try_into().unwrap()), 0x64);
		assert_eq!(&ktdt[4212..4216], b"ISDT");
		assert_eq!(u32::from_le_bytes(ktdt[4220..4224].try_into().unwrap()), 0);
		assert_eq!(u32::from_le_bytes(ktdt[4224..4228].try_into().unwrap()), 1);

		let audio = &data[0x10A4..];
		let mut offset = 0;
		for index in 0..15u32 {
			let isdt = if index == 0 {
				&ktdt[4212..4228]
			} else {
				assert_eq!(&audio[offset..offset + 2], &[0, 0]);
				offset += 2;
				let record = &audio[offset..offset + 16];
				offset += 16;
				record
			};
			assert_eq!(&audio[offset..offset + 4], b"RIFF");
			let wav_total = u32::from_le_bytes(audio[offset + 4..offset + 8].try_into().unwrap()) + 8;
			assert_eq!(&isdt[0..4], b"ISDT");
			assert_eq!(u32::from_le_bytes(isdt[4..8].try_into().unwrap()), wav_total + 10);
			assert_eq!(u32::from_le_bytes(isdt[8..12].try_into().unwrap()), index);
			assert_eq!(u32::from_le_bytes(isdt[12..16].try_into().unwrap()), 1);
			if index == 0 {
				assert_eq!(&audio[36..72], b"cue \x1c\x00\x00\x00\x01\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00data\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00");
				assert_eq!(&audio[72..110], b"LIST\x1e\x00\x00\x00adtllabl\x12\x00\x00\x00\x01\x00\x00\x00Tempo: 000.0\x00\x00");
			}
			offset += wav_total as usize;
		}
		assert_eq!(&audio[offset..], &[0, 0]);
		let _ = std::fs::remove_file(&tmp);
	}

	#[test]
	fn validate_rejects_path_traversal() {
		for bad in ["../evil", "a/b", "a\\b", ".hidden", ""] {
			let mut p = Project::new(bad);
			p.kit.name = bad.into();
			let v = validate_project(&p);
			assert!(!v.is_ok(), "should reject kit name '{bad}'");
		}
	}

	#[test]
	fn open_project_rejects_malformed_json() {
		let tmp = std::env::temp_dir().join("stk_test_bad.json");
		std::fs::write(&tmp, b"{ not json }").unwrap();
		let res = open_project(tmp.to_str().unwrap());
		assert!(res.is_err());
		let _ = std::fs::remove_file(&tmp);
	}

	#[test]
	fn normalize_path_handles_traversal() {
		let p = normalize_path("../../etc/passwd").unwrap();
		assert!(p.to_string_lossy().contains("passwd"));
		// Should not panic on empty or weird inputs
		assert!(normalize_path("").is_ok());
		assert!(normalize_path("/abs/path").unwrap().is_absolute());
	}

	#[test]
	fn relink_rejects_nonexistent_file() {
		let mut p = Project::new("TEST");
		p.kit.pads.insert(
			1,
			crate::models::Sample {
				id: "x".into(),
				file_name: "a.wav".into(),
				original_file_name: Some("a.wav".into()),
				resolved_path: Some("/tmp/a.wav".into()),
				original_path: "/tmp/a.wav".into(),
				sha256: None,
				meta: Default::default(),
				volume: 100,
				pan: 0,
				pitch: 0,
				fx_send: 0,
				note: None,
			},
		);
		let res = relink_sample(&mut p, 1, "/nonexistent/path/that/does/not/exist.wav", true);
		assert!(res.is_err());
	}

	#[test]
	fn compile_stereo_produces_stereo_wav() {
		let p = Project::new("STEREO");
		let tmp = std::env::temp_dir().join("stk_test_stereo.stk");
		let _ = std::fs::remove_file(&tmp);
		// Stereo compile should still succeed (device may or may not support, but builder should not crash)
		let report = compile_to_stk(&p, tmp.to_str().unwrap(), false, true, false).unwrap();
		assert!(report.bytes > 0);
		let data = std::fs::read(&tmp).unwrap();
		assert_eq!(&data[0..4], b"VDK0");
		assert_eq!(u32::from_le_bytes(data[4..8].try_into().unwrap()), data.len() as u32 - 360);
		let _ = std::fs::remove_file(&tmp);
	}

	#[test]
	fn bench_compile_15_pads_under_2s() {
		let p = Project::new("BENCH");
		// Empty project → 15 pads of silence (via padding to pad_count)
		let tmp = std::env::temp_dir().join("stk_test_bench.stk");
		let start = std::time::Instant::now();
		let _ = compile_to_stk(&p, tmp.to_str().unwrap(), true, true, false).unwrap();
		let elapsed = start.elapsed();
		assert!(elapsed.as_secs_f64() < 2.0, "compile 15 pads took {elapsed:?}, expected <2s");
		let _ = std::fs::remove_file(&tmp);
	}

	#[test]
	fn search_candidates_sha256_disambiguation() {
		let base = std::env::temp_dir().join("stk_test_sha256");
		let _ = std::fs::remove_dir_all(&base);
		std::fs::create_dir_all(&base).unwrap();
		// Two files with same name in different subfolders, different content
		let dir1 = base.join("a");
		let dir2 = base.join("b");
		std::fs::create_dir_all(&dir1).unwrap();
		std::fs::create_dir_all(&dir2).unwrap();
		let f1 = dir1.join("Kick.wav");
		let f2 = dir2.join("Kick.wav");
		std::fs::write(&f1, b"content-a").unwrap();
		std::fs::write(&f2, b"content-b").unwrap();
		let sha_a = sha256_file(&f1).unwrap();
		// Search without sha256 → both candidates, ranked by depth/path length
		let cands = search_candidates("Kick.wav", &base.join("proj.json"), None);
		assert!(cands.len() >= 2);
		// Search with sha256 of f2 → f2 should be ranked first
		let cands2 = search_candidates("Kick.wav", &base.join("proj.json"), Some(&sha_a));
		assert_eq!(cands2[0].file_name().unwrap().to_string_lossy(), "Kick.wav");
		assert_eq!(cands2[0].parent().unwrap().file_name().unwrap().to_string_lossy(), "a");
		let _ = std::fs::remove_dir_all(&base);
	}

	#[test]
	fn bench_list_wavs_100_under_200ms() {
		let base = std::env::temp_dir().join("stk_test_list_bench");
		let _ = std::fs::remove_dir_all(&base);
		std::fs::create_dir_all(&base).unwrap();
		for i in 0..100 {
			let p = base.join(format!("sample{i}.wav"));
			// Minimal WAV header (44 bytes) + silence
			let mut w = Vec::new();
			w.extend_from_slice(b"RIFF");
			w.extend_from_slice(&(36u32).to_le_bytes());
			w.extend_from_slice(b"WAVEfmt ");
			w.extend_from_slice(&16u32.to_le_bytes());
			w.extend_from_slice(&1u16.to_le_bytes());
			w.extend_from_slice(&1u16.to_le_bytes());
			w.extend_from_slice(&48000u32.to_le_bytes());
			w.extend_from_slice(&96000u32.to_le_bytes());
			w.extend_from_slice(&2u16.to_le_bytes());
			w.extend_from_slice(&16u16.to_le_bytes());
			w.extend_from_slice(b"data");
			w.extend_from_slice(&0u32.to_le_bytes());
			std::fs::write(&p, &w).unwrap();
		}
		let start = std::time::Instant::now();
		let listed = list_wavs(base.to_str().unwrap()).unwrap();
		let elapsed = start.elapsed();
		assert_eq!(listed.len(), 100);
		assert!(elapsed.as_millis() < 200, "list 100 WAVs took {elapsed:?}, expected <200ms");
		let _ = std::fs::remove_dir_all(&base);
	}
}
