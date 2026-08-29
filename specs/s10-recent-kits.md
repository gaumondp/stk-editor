# S10 — Recent kits

Status: partial (Rust store + Tauri commands + Svelte store exist; UI menu partial).
Scope: §15.

## Scope

MRU list of recently opened/created projects, persisted across sessions.
Max 12 entries. Shown in TopBar "Recent" menu and on empty-state welcome.

## Data model (RecentEntry, RecentStore)
```ts
interface RecentEntry {
  path: string;              // absolute, canonicalized
  name: string;              // kit name at last touch
  last_opened: string;       // ISO-ish timestamp (seconds since epoch)
  last_modified: string;     // file mtime at touch
  missing: boolean;          // project file not found
  has_missing_files: boolean;// any sample unresolved
  unsaved: boolean;          // dirty when last closed (always false on touch)
}
interface RecentStore { entries: RecentEntry[] }
```

## Persistence
- File: `~/Library/Application Support/stk-editor/recent.json`
  (macOS) / `%LOCALAPPDATA%\stk-editor\recent.json` (Windows).
- Atomic write (tmp → rename).
- Loaded on app startup → `recentStore` writable.

## Tauri commands
- `cmd_load_recent() → RecentStore`
- `cmd_touch_recent(path, name) → RecentStore` — dedupe by path, insert at 0,
  truncate to 12, update timestamps, recompute `missing` + `has_missing_files`.
- `cmd_clear_recent() → void`
- `cmd_remove_recent(path) → RecentStore` — remove by path or basename.

## Touch rules
- Called on: `open_project` success, `save_project` success, `new_kit` (no
  path → not added until saved).
- Canonicalizes path (resolves symlinks); stores absolute.
- `name` = kit name from project; fallback = file stem.
- `missing` = file doesn't exist at touch time.
- `has_missing_files` = scans project for unresolved samples (best-effort).
- `unsaved` = always false on touch (only set on dirty close, not persisted).

## UI (TopBar Recent menu)
- List entries: kit name + subtle path tooltip.
- Badges: ⚠ missing project file / ⚠ missing samples / ● unsaved (not in V1).
- Click entry → `guardUnsaved()` → `openKit(path)`.
- "Clear recent" at bottom.
- Hover → highlight; keyboard ↑/↓ / Enter to open.

## Gaps / TODOs
- [ ] UI: Recent menu in TopBar (currently only store + commands).
- [ ] Welcome screen on empty project: show recent list + "New Kit" / "Open".
- [ ] `unsaved` flag: persist dirty state on app close (requires Tauri `onClose`).
- [ ] Sort by `last_modified` option (currently MRU by `last_opened`).
- [ ] Right-click entry → "Show in Finder/Explorer" / "Remove from list".
- [ ] Sync `has_missing_files` on project open (refresh after relink).

## Acceptance
- Open project → appears at top of Recent.
- Save As → new path added, old path removed (dedupe).
- 13th open → oldest dropped (cap 12).
- Missing project file → badge shown, click → error toast, entry stays.
- Missing samples → badge shown, click → opens project (S08 handles relink).
- Clear recent → list empty, file deleted.
- Remove single → entry gone, order preserved.
- Restart app → recent list restored from disk.