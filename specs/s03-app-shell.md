# S03 — App shell, top bar, states, display modes

Status: partial (layout + top bar + status pill exist; gaps listed below).
Scope: §5, §6, §7.

## Scope

Layout (single window, resizable, min 960×640):

1. Top bar (full width).
2. Central stage: device representation.
3. Audio explorer (left aside).
4. Kit panel (right aside).
5. Recent kits menu (top bar / menu row).
6. Help menu.
7. Language selector.
8. Status indicator.
9. Confirmation dialogs (unsaved, overwrite, relink).
10. Short toasts (success/error/warn) via `src/stores/notify.ts`.

## Top bar contents (§6)

Logo mark + product name, app version, open project name (title = full path),
modified indicator, Save, Save As, Compile, Export SD (hardware/full),
display-mode select, language select, Help menu, Recent menu, Git connection
state indicator (S13).

## Project states (§6.1) — status pill vocabulary

| id | label (i18n) | kind |
|---|---|---|
| `saved` | Sauvegardé / Saved | ok |
| `modified` | Modifié / Modified | warn (immediately visible) |
| `saving` | Sauvegarde en cours… | busy |
| `compiling` | Compilation en cours… | busy |
| `compile_ok` | Compilation réussie | ok |
| `compile_error` | Erreur de compilation | error |
| `missing` | Fichier audio manquant | error |
| `invalid` | Projet non valide | error |
| `git_conflict` | Conflit Git | error |
| `git_syncing` | Synchronisation Git en cours | busy |
| `git_sync_ok` | Synchronisation Git réussie | ok |
| `git_error` | Erreur Git | error |

## Display modes (§7)

- `full`: chassis + LCD + logos/labels + decorative controls + nav buttons +
  16 pads + track button + both panels.
- `pads`: decorative parts hidden/collapsed; pads maximized (numbers, file
  names, status, DnD, selection, removal, prelisten all still work).
- Choice persisted in app preferences (local JSON) and restored at startup.
  **Gap today**: `viewMode` is session-only → persist it.

## Rules

- Status pill + modified indicator update on every dirty change, before the
  user moves the mouse (store-driven, not event-driven UI polling).
- Busy states disable conflicting actions (compile/save while busy).
- All labels via i18n keys; no literal text in TopBar (S12).
- Dialogs are modal, focus-trapped, Escape closes where cancel semantics exist.

## Acceptance

- All 12 states reachable and visually distinct (color + icon/text, S15).
- `pads` mode hides LCD/controls and enlarges pad grid; switching back is lossless.
- View mode + language survive app restart (persistence test).
- Top bar shows correct version from `tauri.conf.json` (single source, not
  hand-copied `APP_VERSION` constant → read from injected meta or config).
