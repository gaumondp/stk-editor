# S09 — Export to SD

Status: partial (`export_sd` in Rust exists; UI dialog + options partial). Scope: §13.

## Scope

Write a complete SD-card layout for SmplTrek 3.2 from a project. Two profiles:
- **Hardware**: only files the device reads (kit `.stk` in `SmplTrek/Pool/Kit`).
- **Full**: hardware files + WAV samples + project JSON + README (for backup/
  re-editing on another machine).

No SQLite in V1 (JSON only).

## Export flow (lib.rs → export_sd)
1. Resolve device profile from project (`device.profile` + `device.firmware`).
2. Compile project → temp `.stk` (mono, overwrite).
3. For each folder in profile:
   - `hardware` → `sd_hardware_folders()` (only `SmplTrek/Pool/Kit`).
   - `full` → `sd_root_folders()` (Kit + `SmplTrek/Pool/Audio/Drum`).
4. Copy `.stk` into each Kit folder (sanitized kit name).
5. If `full`:
   - Copy WAVs for active pads → `Audio/Drum` (skip if file exists).
   - Write project JSON → `projects/{kit}.json`.
   - Write `README.txt` with kit info, version, compatibility notice.
6. Cleanup temp compile dir.
7. Return `ExportReport { base_dir, paths[], note }`.

## SD folder structure (SmplTrek 3.2 profile)
```
<base_dir>/
├── SmplTrek/
│   └── Pool/
│       ├── Kit/                    # hardware + full
│       │   └── MY_KIT.stk
│       └── Audio/
│           └── Drum/               # full only
│               ├── Kick.wav
│               └── Snare.wav
└── projects/                       # full only
    └── MY_KIT.json
└── README.txt                      # full only
```

## ExportOptions (commands.ts)
```ts
interface ExportOptions {
  base_dir: string;      // target root (e.g. /Volumes/SD_CARD)
  profile: 'hardware' | 'full';
  copy_samples?: boolean; // default true (only for 'full')
}
```

## Sanitization
Kit name → filename: strip `/` `\`, trim. Used for `.stk`, `.json`, WAV dest.

## README.txt template
```
SmplTrek Kit — {kit_name}

Exported by SmplTrek Kit Builder v{app_version}.
Device: smpltrek (profile smpltrek, firmware 3.2).
Pads filled: {n}.

COMPATIBILITY
This kit was built for the Sonicware SmplTrek (firmware 3.2). Compatibility
with other Sonicware synthesizers or firmware versions is NOT guaranteed.

JSON project files in this export are for re-editing with SmplTrek Kit
Builder. They are NOT read by the SmplTrek itself.
```

## Tauri command
`cmd_export(project, opts) → ExportReport`

## Rules
- Target directory created if missing (recursive).
- Overwrite existing `.stk` in Kit folder (user chose Export → implicit overwrite).
- WAV copy: only if dest doesn't exist (avoid clobbering user's SD files).
- `copy_samples=false` (Full profile) → skip WAV copy, still write JSON + README.
- No credentials, no hidden files, no `.DS_Store` / `Thumbs.db`.
- Errors: permissions, disk full, read-only SD → typed error to UI.

## Gaps / TODOs
- [ ] UI: Export dialog with folder picker (Tauri `dialog.open` dir only).
- [ ] UI: Profile radio (Hardware / Full) + `copy_samples` checkbox (Full only).
- [ ] Progress toast for large exports (WAV copy can be slow).
- [ ] Verify written `.stk` is loadable (optional post-export validate).
- [ ] Eject SD hint (macOS: `diskutil eject`; Windows: `Eject`).
- [ ] Test on real SD card (exFAT/FAT32) — path length, case sensitivity.
- [ ] Profile-driven: new device → new folders via profile (S01).

## Acceptance
- Hardware export: only `SmplTrek/Pool/KIT/MY_KIT.stk` created.
- Full export: all folders + WAVs + JSON + README created.
- WAVs copied only for assigned active pads; missing pads skipped.
- Existing WAV on SD not overwritten.
- README contains correct kit name, version, pads filled.
- ExportReport lists all written paths; note explains profile.
- Errors (no space, no permission) surfaced as typed strings.