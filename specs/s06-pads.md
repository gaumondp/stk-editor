# S06 — Pads (SVG, DnD, remove, prelisten)

Status: partial (SVG grid + DnD + Cmd/Ctrl-Click + prelisten stub exist; gaps below).
Scope: §8, §9, §4.1, §21.

## Scope

Interactive 16-pad grid driven by `DeviceProfile` (S01). Vector (SVG)
rendering, 4×4 layout, per-pad states, drag-drop from explorer/OS, removal,
prelisten.

## SVG structure (DeviceView.svelte)
- Single `<svg>` with `viewBox="0 0 WIDTH HEIGHT"` computed from profile
  `pad_count` (16) → 4 cols × 4 rows.
- Each pad: `<g class="pad {state}" data-pad={1..16} transform="translate(x,y)">`
  - `<rect class="pad-bg" width={PAD_W} height={PAD_H} rx="6">`
  - `<text class="pad-num">` (pad number, top-left).
  - `<text class="pad-name">` (file name, centered) — only if assigned.
  - `<text class="pad-missing-path">` (original path in red) — only if missing.
- Special pad (16): `tabindex=-1`, `draggable=false`, shows "TRACK" label.
- CSS classes for states (see below).

## Pad visual states (CSS-driven)
| State | Class | Visual |
|---|---|---|
| empty | `.pad.empty` | dim fill, no name |
| assigned | `.pad.assigned` | green fill, file name |
| selected | `.pad.selected` | accent stroke 2.5px |
| dragover | `.pad.dragover` | blue stroke + brightness |
| missing | `.pad.missing` | red fill, original path in red above name |
| invalid | `.pad.invalid` | amber fill, warning icon |
| disabled | `.pad.disabled` | dark fill, 0.7 opacity, not focusable |
| previewing | `.pad.previewing` | pulsing accent ring (TODO) |

## Interaction contract (store-driven, S05/S13)

| Action | Trigger | Effect |
|---|---|---|
| select | click pad (1–15) | `selectPad = i`; highlight; KitPanel shows details |
| assign (new) | drop WAV on empty pad (1–15) | `assignSample(pad, sample)`; dirty; undo snapshot |
| replace | drop WAV on assigned pad (1–15) | `assignSample(pad, sample, replace=true)`; dirty; undo |
| remove | Ctrl-Click (Win) / Cmd-Click (mac) on assigned | `removeSample(pad)`; **file on disk untouched**; dirty; undo; toast |
| remove (alt) | Delete/Backspace on selected pad | same as above |
| prelisten | Space on selected pad / double-click explorer row | play/stop; auto-stop on new; "playing" indicator on pad |

## Drag-drop details
- Explorer → pad: `text/plain` payload = absolute file path.
- OS file manager → pad: `text/uri-list` (multiple) → take first `.wav`.
- Only hovered pad gets `dragover` class; others unchanged.
- Drop on pad 16 (disabled) → ignored.
- Drop outside pads → cancel, no state change.

## Validation on drop (instant, before commit)
1. File exists.
2. Extension `.wav` (case-insensitive).
3. `audio_meta(path)` → readable, parseable, supported format.
4. Failure → pad `.invalid` + error toast; pad unchanged.

## Prelisten engine (single global)
- One `previewer` instance (Web Audio or `<audio>`).
- `previewer.play(path)` → plays; second call on same → stops.
- `previewer.stop()` → stops.
- Auto-stop when another pad/row starts.
- Escape key stops preview.
- Indicator: `.pad.previewing` class + explorer row highlight.

## KitPanel integration (right aside)
On `selectPad`:
- Show pad number, file name, current path, original path (if different).
- Show metadata: duration, sample rate, bits, channels.
- Editable params: volume (0–100), pan (-64..63), pitch (±1200), fx_send (0–127).
- Changes → `setParam(pad, param, value)` → dirty + undo.

## Gaps / TODOs
- [ ] OS file-manager drag (text/uri-list) onto pads.
- [ ] Replace-confirmation dialog when custom params ≠ defaults.
- [ ] Per-pad prelisten indicator on SVG (`.pad.previewing`).
- [ ] Delete/Backspace removal on selected pad.
- [ ] Double-click assigned pad = prelisten.
- [ ] Keyboard navigation: arrow keys move selection across grid.
- [ ] Pad tooltip with full details (path, original, meta, params).
- [ ] Profile-driven grid: regenerate on profile change (S01).

## Acceptance
- All 9 pad states visually distinct (screenshots, both OSes).
- DnD from explorer + OS file manager assigns correctly.
- Cmd/Ctrl-Click removes assignment only (file preserved).
- Undo restores pad content (assign/replace/remove).
- Prelisten starts/stops/auto-stops; no overlap.
- Invalid file rejected with clear state + toast.
- Grid regenerates from profile (pad count, special pads).