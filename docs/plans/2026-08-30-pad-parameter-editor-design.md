# Pad Parameter Editor Design

**Date:** 2026-08-30
**Status:** Approved

## Goal

Add one shared parameter editor directly below **Audio pad assignments**. Selecting either an assignment row or a physical pad selects the same pad and displays its sample controls.

## User interface

The editor is a single panel with a selected-pad heading and four rotary controls:

- Volume: 0–100
- Pan: −64–63
- Pitch: −1200–1200 cents
- FX send: 0–127

Each control resembles a mixer-console potentiometer: a knurled outer rim, a visible indicator, the localized parameter label, and its current value. Clicking or vertically dragging a rotary control makes it active; dragging up increases its value and dragging down decreases it within its allowed range.

Below the four controls, one localized numeric text field edits the active parameter precisely. Enter and focus loss apply a valid value. Escape restores the value present when the field received focus. Invalid or out-of-range input is not applied and exposes the applicable range.

The full panel is disabled when no pad is selected or when the selected pad has no audio assignment. It does not create parameter values for an empty pad.

## Data flow

`DeviceView.svelte` continues to own the existing `selectPad` state, so assignment rows and physical pads remain synchronized. It reads the selected sample from `$project.kit.pads[selectPad]` and delegates committed values to the existing `setParam(pad, param, value)` store action. This preserves dirty-state tracking, validation refreshes, and coalesced undo history without adding a second project state.

## Interaction and accessibility

The editor uses project theme tokens and adapts to narrow layouts. Each rotary control has a keyboard-focusable accessible name and exposes its current value and range. Keyboard users can select a parameter and use the text field for precise values; mouse dragging remains an enhancement rather than the only path.

Existing pad selection, preview, drag-and-drop, delete, and arrow navigation remain unchanged. Dragging a rotary control must not start pad assignment drag behavior.

## Validation and tests

Tests cover:

1. Selecting a row or physical pad synchronizes the active editor.
2. The editor is disabled for no selection and empty pads.
3. Mouse drag clamps each parameter to its range and commits through `setParam`.
4. Text input applies on Enter and blur, and Escape restores the prior value.
5. Invalid text and out-of-range values do not alter the sample.
6. Existing undo/redo behavior records committed changes without rapid-drag stack bloat.
7. E2E coverage confirms the rendered rotary controls, selection state, and keyboard editing flow.
