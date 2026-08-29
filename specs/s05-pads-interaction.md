# S05 — Pad assignment, drag-drop, removal, prelisten

Status: partial (DnD + Cmd/Ctrl-Click + prelisten stub exist; gaps below).
Scope: §9, §21.

## Contract — user operations on pads

| Action | Trigger | Effect |
|---|---|---|
| select | click pad | selected; info shown (panel + tooltip) |
| assign (new) | drop WAV from explorer | pad assigned; resolved+original path + meta captured; dirty; undo snapshot |
| replace | drop WAV on assigned pad | replaced (confirm if it would lose config, e.g. custom params); dirty; undo |
| remove | Ctrl-Click (Win) / Cmd-Click (macOS) | assignment removed; **file on disk untouched**; pad empty; dirty; undo; success toast |
| remove (alt) | Delete/Backspace on selected pad | same as above |
| prelisten | double-click file (explorer) / Space | play/stop; auto-stop when another starts; "playing" indicator on pad/file |

## Rules

- A plain click **never** removes a sample.
- Drop target must be pad-specific: only the hovered pad gets `dragover` state;
  drop outside pads cancels with no state change.
- Assigning captures `originalPath` = the source location at assignment time;
  `resolvedPath` = same at assignment (relative if inside project dir).
- `id` is stable per sample; replacement keeps pad slot, new id for new file.
- WAV dropped → validate instantly (exists, readable, parseable, mono/stereo,
  supported format); failure → `invalid` state + error toast, pad unchanged.
- Prelisten uses a single audio engine (one playing at a time); Space toggles;
  Escape stops (or closes dialog first, S14).

## Gaps to implement

- Drop from **OS file manager** (drag-outside-app WAVs) onto pads — currently
  only explorer→pad DnD. Use `text/uri-list`/FS payload via Tauri DnD APIs.
- Replace-confirmation when custom params (volume/pan/pitch/fx ≠ defaults)
  would be lost.
- Per-pad prelisten indicator on the SVG (currently only explorer-side).
- Delete/Backspace removal on selected pad.
- Double-click on an assigned pad = prelisten that sample.
- Info display for selected pad: current path, original path, duration,
  sample rate/bits/channels, params (Kit panel extended).

## Acceptance

- §22 test list items: assign by DnD; replace; Win Ctrl-Click / mac Cmd-Click
  removal; file never deleted; prelisten start/stop/auto-stop; invalid file
  rejected with clear state.
- Undo (Cmd/Ctrl+Z) restores previous pad content for assign/replace/remove;
  redo re-appplies.
