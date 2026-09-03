// Desktop entry point. Wires up the Tauri plugins and registers typed commands.

#![forbid(unsafe_code)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use smpltrek_kit_builder_lib as lib;
use tauri::{Emitter, Manager, PhysicalSize, WindowEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use smpltrek_kit_builder_lib::{
  AudioFile, CompileReport, DeviceProfileInfo, ExportOptions, ExportReport,
  FindMissingReport, Project, RecentStore, ValidationResult,
};
use smpltrek_kit_builder_lib::stk_inspect::{StkExtractReport, StkInspectReport};
use smpltrek_kit_builder_lib::sd_card::SdCardReport;
use smpltrek_kit_builder_lib::diagnostics::Diagnostics;

fn frontend_menu_event(menu_id: &str) -> Option<&'static str> {
   match menu_id {
      "open_about" => Some("open-about"),
      "quit" => Some("request-quit"),
      _ => None,
   }
}

fn main() {
   tauri::Builder::default()
      .setup(|app| {
         if let Some(window) = app.get_webview_window("main") {
            if let Some(size) = lib::load_window_size() {
               let _ = window.set_size(PhysicalSize::new(size.width, size.height));
            }
            window.on_window_event(|event| {
               if let WindowEvent::Resized(size) = event {
                  lib::save_window_size(lib::WindowSize { width: size.width, height: size.height });
               }
            });
         }
         let quit = MenuItemBuilder::with_id("quit", "Quit STK Forge")
            .accelerator("CmdOrCtrl+Q")
            .build(app)?;
         let app_menu = SubmenuBuilder::new(app, "STK Forge")
            .text("open_about", "About STK Forge")
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .item(&quit)
            .build()?;
         let menu = MenuBuilder::new(app).item(&app_menu).build()?;
         app.set_menu(menu)?;
         app.on_menu_event(|handle, event| {
            if let Some(frontend_event) = frontend_menu_event(event.id().as_ref()) {
               let _ = handle.emit(frontend_event, ());
            }
         });
         Ok(())
      })
      .plugin(tauri_plugin_fs::init())
      .plugin(tauri_plugin_dialog::init())
      .invoke_handler(tauri::generate_handler![
        // project
        cmd_open_project,
        cmd_save_project,
        cmd_validate,
        // profile
        cmd_get_profile,
       // recent
        cmd_load_recent,
        cmd_touch_recent,
        cmd_clear_recent,
        cmd_remove_recent,
        cmd_set_recent_unsaved,
       // missing
        cmd_find_missing,
        cmd_relink,
        cmd_search_candidates,
       // compile / export
        cmd_compile,
        cmd_export,
       // audio
        cmd_list_wavs,
        cmd_audio_meta,
       // inspect
        cmd_inspect_stk,
        cmd_extract_stk,
        // sd card
        cmd_inspect_sd_card,
        // diagnostics
        cmd_diagnostics,
        // application lifecycle
        cmd_exit_app
      ])
      .run(tauri::generate_context!())
      .expect("error while running STK Forge");
}

// ── Project ──────────────────────────────────────────────────────────────

/// Open, migrate and resolve a project JSON at `path`. Errors on unreadable or
/// invalid JSON, or an unsupported project format/version.
#[tauri::command]
fn cmd_open_project(path: String) -> Result<Project, String> {
   lib::open_project(&path)
}

/// Validate and atomically save `project` to `path`, updating the recent list.
/// Errors if the project fails validation or the write fails.
#[tauri::command]
fn cmd_save_project(path: String, project: Project) -> Result<(), String> {
   lib::save_project(&path, &project)
}

/// Validate `project` against its device profile and return the errors/warnings.
#[tauri::command]
fn cmd_validate(project: Project) -> ValidationResult {
   lib::validate_project(&project)
}

// ── Recent ───────────────────────────────────────────────────────────────

/// Load the recent-kits list (empty if none saved yet).
#[tauri::command]
fn cmd_load_recent() -> Result<RecentStore, String> {
   lib::load_recent()
}

/// Add or update a recent entry for `path`/`name` (MRU order); returns the list.
#[tauri::command]
fn cmd_touch_recent(path: String, name: String) -> Result<RecentStore, String> {
   lib::touch_recent(&path, &name)
}

/// Clear the entire recent-kits list.
#[tauri::command]
fn cmd_clear_recent() -> Result<(), String> {
   lib::clear_recent()
}

/// Remove the recent entry for `path`; returns the updated list.
#[tauri::command]
fn cmd_remove_recent(path: String) -> Result<RecentStore, String> {
   lib::remove_recent(&path)
}

/// Set the `unsaved` flag on the recent entry for `path`; returns the list.
#[tauri::command]
fn cmd_set_recent_unsaved(path: String, unsaved: bool) -> Result<RecentStore, String> {
   lib::set_recent_unsaved(&path, unsaved)
}

// ── Missing files ────────────────────────────────────────────────────────

/// Re-resolve missing samples for `project` (rooted at `project_path`) and
/// return a per-sample report of what was found.
#[tauri::command]
fn cmd_find_missing(project: Project, project_path: String) -> Result<FindMissingReport, String> {
   let mut p = project;
   lib::find_missing(&mut p, &project_path)
}

/// Relink pad `pad` of `project` to `new_path`; `keep_original` preserves the
/// recorded original path. Returns the updated project. Errors if the file is
/// missing or the pad has no sample.
#[tauri::command]
fn cmd_relink(
   project: Project,
   pad: u8,
   new_path: String,
   keep_original: bool
) -> Result<Project, String> {
   let mut p = project;
   lib::relink_sample(&mut p, pad, &new_path, keep_original)?;
   Ok(p)
}

/// Search for candidate files matching `file_name` under `base_path`, optionally
/// disambiguated by `sha256`. Returns candidate absolute paths, best first.
#[tauri::command]
fn cmd_search_candidates(file_name: String, base_path: String, sha256: Option<String>) -> Result<Vec<String>, String> {
   let base = std::path::PathBuf::from(base_path);
   let cands = lib::search_candidates(&file_name, &base, sha256.as_deref());
   Ok(cands.into_iter().map(|p| p.to_string_lossy().into_owned()).collect())
}

// ── Compile / Export ────────────────────────────────────────────────────

/// Compile `project` to a `.stk` at `output_path` (`mono`/`overwrite` control
/// channel count and clobbering). Returns a compile report; errors on
/// validation failure, an existing output, a missing sample, or I/O error.
/// When `skip_unreadable` is false, an unreadable pad aborts the compile and
/// the offending pads are returned in the error (UNREADABLE_PADS: prefix);
/// when true, those pads are written as silence.
#[tauri::command]
fn cmd_compile(
   project: Project,
   output_path: String,
   mono: bool,
   overwrite: bool,
   skip_unreadable: bool
) -> Result<CompileReport, String> {
   lib::compile_to_stk(&project, &output_path, mono, overwrite, skip_unreadable)
}

/// Export `project` to an SD-card layout described by `opts`. Returns the list
/// of written paths; errors on compile or I/O failure.
#[tauri::command]
fn cmd_export(project: Project, opts: ExportOptions) -> Result<ExportReport, String> {
   lib::export_sd(&project, opts)
}

// ── Audio ─────────────────────────────────────────────────────────────────

/// List the WAV files in `dir` with metadata and compatibility flags.
/// Errors if `dir` is not a directory.
#[tauri::command]
fn cmd_list_wavs(dir: String) -> Result<Vec<AudioFile>, String> {
   lib::list_wavs(&dir)
}

/// Describe a single WAV at `path` (metadata + compatibility). Errors if absent.
#[tauri::command]
fn cmd_audio_meta(path: String) -> Result<AudioFile, String> {
   lib::audio_meta(&path)
}

// ── Git ───────────────────────────────────────────────────────────────────

// ── Profile ────────────────────────────────────────────────────────────────

/// Return the device profile info for (`profile`, `firmware`), with paths
/// derived for `kit_title`. Errors if the profile/firmware pair is unknown.
#[tauri::command]
fn cmd_get_profile(profile: String, firmware: String, kit_title: String) -> Result<DeviceProfileInfo, String> {
   let prof = lib::profile::known_profile(&profile, &firmware)?;
   Ok(DeviceProfileInfo::from_profile(prof.as_ref(), &kit_title))
}

/// Inspect the `.stk` archive at `path` and return a diagnostic report with
/// messages localized by `locale`. Errors if the file cannot be read.
#[tauri::command]
fn cmd_inspect_stk(path: String, locale: String) -> Result<StkInspectReport, String> {
   lib::stk_inspect::inspect(&path, &locale)
}

/// Extract the validated `.stk` at `path` into an editable kit under `dest_dir`
/// (optionally named `kit_name`), with messages localized by `locale`. The
/// source is only read. Errors if the archive is invalid or the destination is
/// not empty.
#[tauri::command]
fn cmd_extract_stk(
   path: String,
   dest_dir: String,
   kit_name: Option<String>,
   locale: String
) -> Result<StkExtractReport, String> {
   lib::stk_inspect::extract(&path, &dest_dir, kit_name.as_deref(), &locale)
}

// ── SD card ────────────────────────────────────────────────────────────────

/// Inspect the SD card (or folder) at `selected_path` and report its layout.
#[tauri::command]
fn cmd_inspect_sd_card(selected_path: String) -> Result<SdCardReport, String> {
   lib::sd_card::inspect_sd_card(&selected_path)
}

// ── Diagnostics ────────────────────────────────────────────────────────────
/// Collect host/app diagnostics (OS, RAM, versions) for the About/support view.
#[tauri::command]
fn cmd_diagnostics() -> Diagnostics {
   lib::diagnostics::collect()
}

/// Quit the application process cleanly (exit code 0).
#[tauri::command]
fn cmd_exit_app(app: tauri::AppHandle) {
   app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::frontend_menu_event;

    #[test]
    fn quit_menu_event_requests_a_guarded_frontend_quit() {
        assert_eq!(frontend_menu_event("quit"), Some("request-quit"));
    }
}
