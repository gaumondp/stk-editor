# S07 — Missing files: auto-search + manual relink

Status: partial (`find_missing` + `relink_sample` in Rust exist; UI dialog +
relink flow partial). Scope: §10.3, §10.4, §21.

## Scope

When a project references files that don't exist on this machine, the app:
keeps the sample visible, marks state, preserves `originalPath`, and offers
automatic then manual reliaison. Compilation stays blocked until resolved.

## Contract — per-sample data (S02)

`id` (stable), `fileName`, `originalPath` (immutable by relink), `resolvedPath`
(current), `sha256` (if captured), `meta`.

## Missing-file UI state (S04/S06)

- Pad: `missing` state; file name shown; **original path in red above name**.
- Kit panel / explorer: list of missing samples with actions.
- Global button: **"Rechercher les fichiers manquants" / "Search missing files"**.
- Per-file action: **"Relier ce fichier" / "Link this file"** → file picker;
  on pick: re-capture meta + sha256, set `resolvedPath`, keep `originalPath`.
  Relink updates dirty + undo.

## Auto-search algorithm (on project open, then on-demand)

1. Search by exact file name in: project folder → parent directories (≤ N).
2. Search recently used folders (recents metadata: last N opened sample dirs,
   persisted in app prefs).
3. Search user-known folders (last-selected explorer dir, configured scan roots).
4. Rank candidates: name match → size match → sha256 match (when known).
5. Exactly one confident candidate (sha256 hit, or name+size unique) →
   auto-relink + toast "file found at …".
6. Multiple plausible candidates → confirmation dialog with the list → user picks.
7. No candidate → propose manual link (file picker).
8. `originalPath` is **never** overwritten by any of the above.

## Rules

- Search is non-interactive except at step 6; never prompts for every miss.
- Compile blocked while ≥1 required sample unresolved (S08 validation).
- A missing sample never removes data from the JSON on save.
- Original path stays visible even after the containing folder is renamed/moved
  (display only; does not block editing).
- No file is ever deleted by relink/search (S21).

## Acceptance

- §22/§23: missing file on open → red path shown, project still editable,
  compile blocked; auto-find by name in project dir succeeds; two same-name
  candidates → confirmation dialog; manual relink works and keeps
  original path; sha256 disambiguation works.
