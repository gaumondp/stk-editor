# S00 — Architecture & conventions

Purpose: keep the codebase shaped so V1 ships and multi-device stays possible.

## Scope
- Stack (locked): Tauri 2 · Rust backend · Svelte 5 runes + TypeScript · Vite · pnpm.
- Frontend: pure state + layout, no system I/O.
- Backend: **all** file/audio/git I/O behind typed Tauri commands
  (`src-tauri/src/main.rs`); frontend mirrors the types in `src/lib/commands.ts`.
- Device-specific behaviour lives only in the profile layer (S01).
- Project = JSON (S02). Compiled artefact = `.STK` (S03). They never mix in one file.

## Current state
- Module split already in place: `models` / `profile` / `wav` / `compile` / `git` / `lib`.
- Store layer `src/stores/app.ts` holds project state + undo/redo.
- TS↔Rust types are mirrored manually (no codegen).

## Key requirements
- One data flow: `UI → store → command → Rust → report → store → UI`.
- Profile-driven: pad count/layout, name rules, path limits, SD roots all read
  from `DeviceProfile` — never hardcoded in UI or compiler.
- Adding a device = new profile struct + registration + one JSON fixture.
  No refactors in compile/export/UI for it.
- Extensible firmware: profile carries `firmware` + per-version limits.
- No SQLite anywhere in V1 (JSON + OS keychain only).
- Documented: `frontendDist` = `../dist`; dev server 1420; commands are the
  only IPC surface.

## Open decisions
- Keep manual TS↔Rust type mirror, or add a codegen step (small: ~12 types)?
  **Default: keep manual** until a fourth change drift happens.

## Acceptance
- `cargo test` + `svelte-check` green; no frontend fs/net calls outside Tauri.
- A second dummy profile compiles and renders with zero touches outside the
  profile module.
