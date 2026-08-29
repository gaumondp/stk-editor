# S05 — UI shell (top bar, states, modes)

Status: partial (TopBar + DeviceView + store status + viewMode exist; gaps below).
Scope: §5, §6, §7, §14, §15.

## Scope

Single-window layout, resizable (min 960×640), persisted geometry.
Three display modes, global status pill, top bar actions, modal dialogs, toasts.

## Layout regions
1. **Top bar** (full width, fixed height).
2. **Central stage**: device representation (DeviceView).
3. **Left aside**: AudioExplorer (S07).
4. **Right aside**: KitPanel (pad params, notes, missing files list).
5. **Overlays**: dialogs, toasts, shortcuts help.

## Top bar contents (left → right)
- Logo mark + "SmplTrek Kit Builder".
- App version (from `tauri.conf.json` at build, injected via Vite `define`).
- Project name (click → copy full path; tooltip = full path).
- Modified indicator (● dot, orange when dirty).
- **Save** / **Save As** (disabled when not dirty or saving).
- **Compile** (output .stk dialog; disabled when compiling or invalid).
- **Export SD** ▼ (Hardware / Full; disabled when compiling/exporting).
- **Display mode** ▼ (Full / Pads).
- **Language** ▼ (Français / English).
- **Help** ▼ (Shortcuts / README / About).
- **Recent** ▼ (list of recent kits, S10).
- **Git** indicator (S12: clean / ahead / behind / conflict / syncing).
- **Status pill** (see States below).

## Project states — status pill vocabulary (store-driven)

| id | label (i18n) | kind | color |
|---|---|---|---|
| `saved` | Sauvegardé / Saved | ok | green |
| `modified` | Modifié / Modified | warn | orange |
| `saving` | Sauvegarde en cours… | busy | blue |
| `compiling` | Compilation en cours… | busy | blue |
| `compile_ok` | Compilation réussie | ok | green |
| `compile_error` | Erreur de compilation | error | red |
| `missing` | Fichier audio manquant | error | red |
| `invalid` | Projet non valide | error | red |
| `git_conflict` | Conflit Git | error | red |
| `git_syncing` | Synchronisation Git en cours | busy | blue |
| `git_sync_ok` | Synchronisation Git réussie | ok | green |
| `git_error` | Erreur Git | error | red |

Rules: pill updates **synchronously** on every store mutation (dirty, compile,
git status). No polling. Busy states disable conflicting top-bar actions.

## Display modes (viewMode store, persisted in local JSON)

- `full`: chassis + LCD (SONICWARE / SmplTrek / kit name) + decorative nav
  controls (▲ ▼ ◉ ◂ TRK) + 16-pad grid + both side panels.
- `pads`: decorative layers hidden (CSS `.pads-only`); pad grid maximized to
  available space; all pad interactions work (DnD, click, prelisten, remove).

Switch: instant, no data loss. Persisted in `localStorage` (key `viewMode`);
restored on startup before first render.

## Dialogs & toasts (notify store)
- **Unsaved changes** (S13): modal, focus-trapped, choices Save / Discard /
  Cancel. Escape = Cancel.
- **Overwrite confirm**: Save As / Compile / Export when target exists.
- **Relink picker** (S08): native file dialog, filtered to WAV.
- **Shortcuts help**: modal, searchable, categorized.
- **Toasts**: success (green), warning (orange), error (red); auto-dismiss 3 s;
  stack max 3; click to dismiss.

## Keyboard shortcuts (global, work in all modes)
| Shortcut | Action |
|---|---|
| Cmd/Ctrl+S | Save |
| Cmd/Ctrl+Shift+S | Save As |
| Cmd/Ctrl+E | Compile (opens output dialog) |
| Cmd/Ctrl+Shift+E | Export SD (opens folder dialog) |
| Cmd/Ctrl+, | Settings (placeholder V1.1) |
| Cmd/Ctrl+Z | Undo (S13) |
| Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y | Redo |
| Space | Prelisten selected pad / explorer row |
| Escape | Stop prelisten / close dialog / cancel drag |
| Delete / Backspace | Remove sample from selected pad |
| F1 | Shortcuts help |

## Rules
- All user-visible strings via `tr(key)` (S11). No literals in components.
- Top bar never overlaps stage on resize (flex layout, min-height on stage).
- Version string single-sourced: `tauri.conf.json` → Vite `define` →
  `import.meta.env.APP_VERSION` → TopBar.
- Focus management: dialog opens → trap focus → first button; close →
  return to trigger element.

## Gaps / TODOs
- [ ] Persist `viewMode` + `locale` in app prefs (local JSON, not project).
- [ ] Git indicator in top bar (currently only in store).
- [ ] Version injection from `tauri.conf.json` (currently hardcoded in store).
- [ ] Toast queue + persistence across route (single page, but keep).
- [ ] Focus trap util for dialogs (currently ad-hoc).
- [ ] High-contrast / accessibility audit (S15).

## Acceptance
- All 13 states reachable; pill shows correct label + color.
- Mode switch `full ↔ pads` lossless, persisted across restart.
- Shortcuts work in both modes; no conflicts with text inputs.
- Toasts stack, auto-dismiss, dismissible.
- Unsaved dialog blocks navigation until resolved (S13).