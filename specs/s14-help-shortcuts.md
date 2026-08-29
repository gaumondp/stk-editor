# S14 — Help, shortcuts, README

Status: partial (ShortcutsDialog + HelpMenu stubs exist; content + README pending).
Scope: §14, §19.

## Scope

In-app help system: shortcuts reference, README, About dialog. External
README.md for GitHub/npm.

## Shortcuts reference (ShortcutsDialog.svelte)
Modal, searchable, categorized. Trigger: TopBar Help → Shortcuts / F1.

### Categories & keys (macOS / Windows)
| Category | Action | macOS | Windows |
|---|---|---|---|
| **Global** | Save | Cmd+S | Ctrl+S |
| | Save As | Cmd+Shift+S | Ctrl+Shift+S |
| | Compile | Cmd+E | Ctrl+E |
| | Export SD | Cmd+Shift+E | Ctrl+Shift+E |
| | Undo | Cmd+Z | Ctrl+Z |
| | Redo | Cmd+Shift+Z | Ctrl+Shift+Z / Ctrl+Y |
| | Help / Shortcuts | F1 | F1 |
| **Pads** | Select pad | Click | Click |
| | Assign (drop) | Drag WAV → pad | Drag WAV → pad |
| | Replace (drop) | Drag WAV → assigned pad | Drag WAV → assigned pad |
| | Remove sample | Cmd+Click | Ctrl+Click |
| | Remove (alt) | Delete / Backspace | Delete / Backspace |
| | Prelisten pad | Space (selected) | Space (selected) |
| | Navigate pads | Arrow keys | Arrow keys |
| **Explorer** | Focus explorer | E | E |
| | Focus search | / | / |
| | Prelisten file | Double-click / Space | Double-click / Space |
| | Navigate list | ↑ / ↓ | ↑ / ↓ |
| | Drag to pad | Drag row → pad | Drag row → pad |
| **Dialogs** | Confirm / OK | Enter | Enter |
| | Cancel / Close | Escape | Escape |

### Dialog features
- Search box filters rows (matches key, action, category).
- Platform-aware: shows Cmd/Ctrl based on `navigator.platform`.
- Copy all as Markdown button (for docs).
- Close: Escape / click overlay / Close button.

## Help menu (TopBar Help ▼)
- **Shortcuts** → opens ShortcutsDialog.
- **README** → opens `README.md` in default browser (bundled + GitHub).
- **Report issue** → opens GitHub Issues (pre-filled template).
- **About** → modal: app name, version, license (MIT), link to repo,
  Sonicware disclaimer.

## README.md (repo root, bundled in app)
Sections:
1. **SmplTrek Kit Builder** — one-line pitch.
2. **Requirements** — macOS 13+ / Windows 10+, SmplTrek fw 3.2.
3. **Install** — download .dmg/.msi, or `pnpm tauri build`.
4. **Quick start** — New Kit → drag WAVs → Compile → Export SD.
5. **Project format** — JSON schema link (S02).
6. **Device profile** — SmplTrek 3.2 only (S01).
7. **Building from source** — Rust + Node + pnpm + Tauri CLI.
8. **Contributing** — PR process, code style, spec-driven.
9. **License** — MIT.
10. **Disclaimer** — not affiliated with Sonicware; use at own risk.

## Bundled assets
- `README.md` copied to `dist/` at build → accessible via `app://` or
  extracted to temp for `shell.open`.
- `CHANGELOG.md` (generated from commits, V1.1).
- `LICENSE` (MIT).

## Gaps / TODOs
- [ ] ShortcutsDialog component (currently stub).
- [ ] HelpMenu component (currently stub).
- [ ] About dialog component.
- [ ] README.md content (write from this spec).
- [ ] In-app README viewer (markdown renderer) vs browser open.
- [ ] Contextual help: `?` icon on complex dialogs → tooltip / link.
- [ ] Video/GIF tutorials (hosted, linked from Help menu).

## Acceptance
- F1 / Help → Shortcuts opens, searchable, platform-correct keys.
- Help → README opens in browser (local file or GitHub).
- Help → About shows version, license, disclaimer.
- README.md renders correctly on GitHub + npm.
- All shortcuts in dialog match actual keybindings (S05/S06).
- No dead links in Help menu.