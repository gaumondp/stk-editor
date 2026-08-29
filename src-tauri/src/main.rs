// Desktop entry point. Wires up the Tauri plugins and registers typed commands.

#![forbid(unsafe_code)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use smpltrek_kit_builder_lib as lib;
use tauri::{Emitter, Manager, PhysicalSize, WindowEvent};
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use smpltrek_kit_builder_lib::{
  AudioFile, CompileReport, DeviceProfileInfo, ExportOptions, ExportReport,
  FindMissingReport, Project, RecentStore, ValidationResult,
};
use smpltrek_kit_builder_lib::stk_inspect::{StkExtractReport, StkInspectReport};
use smpltrek_kit_builder_lib::diagnostics::Diagnostics;

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
         let app_menu = SubmenuBuilder::new(app, "STK Editor")
            .text("open_about", "About STK Editor")
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;
         let menu = MenuBuilder::new(app).item(&app_menu).build()?;
         app.set_menu(menu)?;
         app.on_menu_event(|handle, event| {
            if event.id() == "open_about" {
               let _ = handle.emit("open-about", ());
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
        // diagnostics
        cmd_diagnostics
      ])
      .run(tauri::generate_context!())
      .expect("error while running STK Editor");
}

// ── Project ──────────────────────────────────────────────────────────────

#[tauri::command]
fn cmd_open_project(path: String) -> Result<Project, String> {
   lib::open_project(&path)
}

#[tauri::command]
fn cmd_save_project(path: String, project: Project) -> Result<(), String> {
   lib::save_project(&path, &project)
}

#[tauri::command]
fn cmd_validate(project: Project) -> ValidationResult {
   lib::validate_project(&project)
}

// ── Recent ───────────────────────────────────────────────────────────────

#[tauri::command]
fn cmd_load_recent() -> Result<RecentStore, String> {
   lib::load_recent()
}

#[tauri::command]
fn cmd_touch_recent(path: String, name: String) -> Result<RecentStore, String> {
   lib::touch_recent(&path, &name)
}

#[tauri::command]
fn cmd_clear_recent() -> Result<(), String> {
   lib::clear_recent()
}

#[tauri::command]
fn cmd_remove_recent(path: String) -> Result<RecentStore, String> {
   lib::remove_recent(&path)
}

#[tauri::command]
fn cmd_set_recent_unsaved(path: String, unsaved: bool) -> Result<RecentStore, String> {
   lib::set_recent_unsaved(&path, unsaved)
}

// ── Missing files ────────────────────────────────────────────────────────

#[tauri::command]
fn cmd_find_missing(project: Project, project_path: String) -> Result<FindMissingReport, String> {
   let mut p = project;
   lib::find_missing(&mut p, &project_path)
}

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

#[tauri::command]
fn cmd_search_candidates(file_name: String, base_path: String, sha256: Option<String>) -> Result<Vec<String>, String> {
   let base = std::path::PathBuf::from(base_path);
   let cands = lib::search_candidates(&file_name, &base, sha256.as_deref());
   Ok(cands.into_iter().map(|p| p.to_string_lossy().into_owned()).collect())
}

// ── Compile / Export ────────────────────────────────────────────────────

#[tauri::command]
fn cmd_compile(
   project: Project,
   output_path: String,
   mono: bool,
   overwrite: bool
) -> Result<CompileReport, String> {
   lib::compile_to_stk(&project, &output_path, mono, overwrite)
}

#[tauri::command]
fn cmd_export(project: Project, opts: ExportOptions) -> Result<ExportReport, String> {
   lib::export_sd(&project, opts)
}

// ── Audio ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn cmd_list_wavs(dir: String) -> Result<Vec<AudioFile>, String> {
   lib::list_wavs(&dir)
}

#[tauri::command]
fn cmd_audio_meta(path: String) -> Result<AudioFile, String> {
   lib::audio_meta(&path)
}

// ── Git ───────────────────────────────────────────────────────────────────

// ── Profile ────────────────────────────────────────────────────────────────

#[tauri::command]
fn cmd_get_profile(profile: String, firmware: String, kit_title: String) -> Result<DeviceProfileInfo, String> {
   let prof = lib::profile::known_profile(&profile, &firmware)?;
   Ok(DeviceProfileInfo::from_profile(prof.as_ref(), &kit_title))
}

#[tauri::command]
fn cmd_inspect_stk(path: String, locale: String) -> Result<StkInspectReport, String> {
   lib::stk_inspect::inspect(&path, &locale)
}

#[tauri::command]
fn cmd_extract_stk(
   path: String,
   dest_dir: String,
   kit_name: Option<String>,
   locale: String
) -> Result<StkExtractReport, String> {
   lib::stk_inspect::extract(&path, &dest_dir, kit_name.as_deref(), &locale)
}

// ── Diagnostics ────────────────────────────────────────────────────────────

#[tauri::command]
fn cmd_diagnostics() -> Diagnostics {
   lib::diagnostics::collect()
}
