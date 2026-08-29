# S04 — Device SVG representation & pad states

Status: partial (SVG pad grid exists; reference image + fidelity work pending).
Scope: §8, §4.1.

## Scope

Vector (SVG) reconstruction of the SmplTrek front panel, driven by the
official documentation image as the **design reference** (kept in repo, e.g.
`docs/reference/smpltrek-reference.png`, used for comparison, never as the
rendered UI).

## Contract

- Single coherent `viewBox` for the whole device; each pad is an individually
  addressable node (`data-pad`, `role="button"`, `tabindex`).
- Decorative layer and interactive layer separated (groups/classes).
- Crisp at any scale: Retina + Windows high-DPI, no bitmap stretch.

## Pad visual states (all required)

`normal | hover | selected | empty | assigned | dragover | missing | invalid
| disabled | previewing`

- assigned: distinct fill + sample file name.
- missing: original path shown in **red** above the file name + non-color
  cue (e.g. dashed border / ⚠ icon).
- invalid: distinct from missing (e.g. icon/sketch + message in tooltip).
- disabled: pad 16 (profile-driven), not keyboard-focusable, still displayed.
- dragover: highlight + explicit "accepted" affordance; other pads untouched;
  returns to normal on drop or cancel.
- previewing: indicator that this file is currently playing (S05).

Assigned pad info: number, file name, tooltip with full details (current
path, original path if different, duration + metadata).

## Rules

- Layout numbers (pad positions, count, special pads) come from `DeviceProfile`
  (S01) — grid is generated, not hand-drawn per pad.
- `full` view renders LCD (SONICWARE / SmplTrek / kit name) + nav/track
  decorative controls; `pads` view hides them (CSS class `pads-only`).
- Reference image comparison checklist (regression): proportions, pad grid
  position, ratios — checked on macOS + Windows, both views, resized window,
  high-DPI (manual QA list lives in S19).

## Acceptance

- All 10 pad states render distinctly (screenshot set, both OSes).
- 16 pads, 1–15 active, 16 disabled, per profile; switching profile re-renders.
- Resize from 960×640 to 4K stays sharp and proportion-correct.
- Red original path visible only when file absent, above the name.
