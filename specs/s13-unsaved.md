# S13 — Unsaved-change protection & undo

Status: partial (dirty flag + undo/redo stack + guard dialog exist; gaps below).
Scope: §14, §15.

## Scope

Prevent accidental data loss: dirty detection, unsaved-changes guard on
navigation/close, unlimited undo/redo (capped at 100), per-action snapshots.

## Dirty tracking (store)
- `dirty` writable (boolean) — set true on any mutation.
- `status` pill updates to `modified` (orange) immediately.
- Mutations that mark dirty:
  - Kit name change
  - Sample assign/replace/remove
  - Param change (volume/pan/pitch/fx_send)
  - Notes edit
  - Prefs change
  - Relink
  - Missing-file auto-relink
- `setSaved()` called on: successful save, successful open (after load).

## Undo/Redo (store)
- `undoStack: Snapshot[]` (max 100), `redoStack: Snapshot[]`.
- `Snapshot = { project: Project }` — full project clone via `structuredClone`.
- `commit(newProject)`: pushes current to undo, applies new, clears redo,
  marks dirty, refreshes validation.
- `undo()`: pops undo → pushes current to redo → restores snapshot → dirty.
- `redo()`: pops redo → pushes current to undo → restores snapshot → dirty.
- Shortcuts: Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y).
- New project / open project → clears both stacks.

## Unsaved-changes guard (guardUnsaved)
Called before any navigation that would lose state:
- `openKit(path)` (Recent menu, File → Open)
- `newKit()` (File → New)
- `close window` (Tauri `onCloseRequested`)
- `compileKit` / `exportKit` (only if they would overwrite without prompt)

### Flow
```
if (!dirty) → proceed
else:
  show UnsavedDialog (modal, focus-trapped)
  choices: Save / Discard / Cancel
  Save → saveKit() → proceed
  Discard → proceed
  Cancel → abort
```

### UnsavedDialog (UnsavedDialog.svelte)
- Title: "Unsaved changes"
- Message: "You have unsaved changes. Save before continuing?"
- Buttons: Save (primary), Discard, Cancel.
- Escape = Cancel.
- Returns `Promise<'save' | 'discard' | 'cancel'>` via `requestUnsavedDialog()`.

### Tauri window close
```rust
// tauri.conf.json → build → hooks
onCloseRequested: (event) => {
  if (dirty) {
    event.preventDefault();
    guardUnsaved().then((ok) => { if (ok) window.close(); });
  }
}
```

## Rules
- Guard is **async** but blocks the triggering action until resolved.
- Multiple simultaneous guards queued (e.g., close window while dialog open).
- Save in guard uses current `projectPath`; if null → Save As dialog.
- Undo/Redo unavailable during busy states (saving, compiling, exporting).
- Validation re-run after every undo/redo (compile may become invalid).

## Gaps / TODOs
- [ ] Tauri `onCloseRequested` hook wired to `guardUnsaved`.
- [ ] Persist `unsaved` flag in RecentEntry on dirty close (requires Tauri
  `beforeClose` + store serialization).
- [ ] Selective undo (per-pad) vs full project (V1: full only).
- [ ] Undo/Redo menu items in top bar (Help → Undo/Redo).
- [ ] Coalesce rapid param changes (debounce 300 ms) to avoid stack bloat.
- [ ] Test: undo after relink restores originalPath + resolvedPath correctly.
- [ ] Test: undo after missing-file auto-relink restores missing state.

## Acceptance
- Any mutation → dirty=true, pill=orange, Save enabled.
- Save → dirty=false, pill=green.
- Cmd/Ctrl+Z → restores previous project state, dirty=true, validation refreshed.
- Cmd/Ctrl+Shift+Z → re-applies undone change.
- 101st commit → oldest undo dropped (cap 100).
- Open recent with dirty project → guard dialog → Save/Discard/Cancel work.
- Window close with dirty → guard dialog → Save/Discard/Cancel work.
- New Kit with dirty → guard dialog.
- Compile/Export with dirty → allowed (they don't lose project state).