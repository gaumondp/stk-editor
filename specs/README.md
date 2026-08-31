# SmplTrek Kit Builder — Specs

Lightweight specs to drive V1 development. Source of truth:
the *SmplTrek Kit Builder — Requirements* doc. Each spec is kept deliberately
small: **Purpose · Scope · Current state · Key requirements · Open decisions ·
Acceptance**.

Status marks in the index:

- ✅ done — implemented and behaving to spec
- 🔶 partial — scaffolded / working, gaps remain (gaps listed in the spec)
- ⬜ todo — not started

V1 target: Sonicware SmplTrek, firmware **3.2**. Platforms: macOS + Windows.
Read-only knowledge base: `jblamber/stk_writer` (format reference).

## Specs

| # | Spec | Status |
|---|------|--------|
| 00 | [Architecture & conventions](s00-architecture.md) | 🔶 |
| 01 | [Device profile (SmplTrek 3.2)](s01-device-profile.md) | ✅ |
| 02 | [Project model & JSON format](s02-project-model.md) | 🔶 |
| 03 | [`.STK` compilation](s03-compile.md) | 🔶 |
| 04 | [Audio processing (WAV)](s04-audio.md) | 🔶 |
| 05 | [UI shell (top bar, states, modes)](s05-ui-shell.md) | 🔶 |
| 06 | [Pads (SVG, DnD, remove, prelisten)](s06-pads.md) | 🔶 |
| 07 | [Audio explorer](s07-audio-explorer.md) | 🔶 |
| 08 | [Missing files: search + relink](s08-missing-files.md) | 🔶 |
| 09 | [Export to SD](s09-export-sd.md) | 🔶 |
| 10 | [Recent kits](s10-recent-kits.md) | 🔶 |
| 11 | [i18n (FR/EN/JA)](s11-i18n.md) | 🔶 |
| 12 | [Git integration (GitHub + Grok)](s12-git.md) | ⬜ |
| 13 | [Unsaved-change protection & undo](s13-unsaved.md) | 🔶 |
| 14 | [Help, shortcuts, README](s14-help-shortcuts.md) | 🔶 |
| 15 | [File & credential security](s15-security.md) | 🔶 |
| 16 | [Packaging, signing, release](s16-packaging.md) | ⬜ |
| 17 | [Testing plan](s17-testing.md) | ⬜ |

## Conventions for editing these specs

- Keep a spec under ~80 lines. Move detail into the TODO or code.
- `Open decisions` must be resolved (or explicitly deferred to V1.x) before the
  owning spec is marked ✅.
- Update the index status the same day an item lands.
- Never store secrets/tokens in these files.
