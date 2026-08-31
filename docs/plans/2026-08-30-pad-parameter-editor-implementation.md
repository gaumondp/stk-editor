# Pad Parameter Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add one shared, mixer-style rotary editor under Audio pad assignments so a selected assigned pad can edit Volume, Pan, Pitch, and FX send by mouse drag or precise keyboard input.

**Architecture:** Keep pad selection in `DeviceView.svelte`; it already synchronizes assignment rows and physical pads through `selectPad`. Extract only range, parsing, and display metadata into a small pure helper and render the editor in a focused `PadParameterEditor.svelte` component. The component emits valid committed values to `DeviceView`, which calls the existing `setParam` store action and preserves dirty tracking, validation, and coalesced undo history.

**Tech Stack:** Svelte 5 runes, TypeScript, existing Svelte stores, Vitest, Playwright, project i18n tokens and CSS variables.

---

### Task 1: Testable parameter metadata and validation

**Files:**
- Create: `src/lib/pad-parameters.ts`
- Create: `src/lib/pad-parameters.test.ts`

**Step 1: Write failing tests for parameter contracts**

Add tests asserting metadata and boundaries:

```ts
expect(PAD_PARAMETERS.volume).toMatchObject({ min: 0, max: 100, unit: '' });
expect(PAD_PARAMETERS.pan).toMatchObject({ min: -64, max: 63, unit: '' });
expect(PAD_PARAMETERS.pitch).toMatchObject({ min: -1200, max: 1200, unit: 'cents' });
expect(PAD_PARAMETERS.fx_send).toMatchObject({ min: 0, max: 127, unit: '' });
expect(parsePadParameter('101', PAD_PARAMETERS.volume)).toBeNull();
expect(parsePadParameter('-1200', PAD_PARAMETERS.pitch)).toBe(-1200);
```

**Step 2: Verify the test is red**

Run:

```bash
pnpm test src/lib/pad-parameters.test.ts
```

Expected: FAIL because the module does not exist.

**Step 3: Implement the minimal pure helper**

Export a `PadParameter` union, `PAD_PARAMETERS` with localized-key names and bounds, `parsePadParameter`, and `clampPadParameter`. Reject empty, non-finite, fractional, and out-of-range values; do not silently clamp typed input. Use clamping only for mouse-drag calculations.

**Step 4: Verify the helper**

Run:

```bash
pnpm test src/lib/pad-parameters.test.ts
```

Expected: PASS.

### Task 2: Mixer-style shared editor component

**Files:**
- Create: `src/components/PadParameterEditor.svelte`
- Modify: `src/lib/i18n.ts`
- Modify: `src/lib/i18n.test.ts`

**Step 1: Add failing locale coverage**

Add `pad.parameters_title`, `pad.parameter_volume`, `pad.parameter_pan`, `pad.parameter_pitch`, `pad.parameter_fx_send`, `pad.parameter_value`, `pad.parameter_select_audio`, and `pad.parameter_invalid` in the required EN, FR, and JA locale test sets.

**Step 2: Verify locale test fails**

Run:

```bash
pnpm test src/lib/i18n.test.ts
```

Expected: FAIL on missing new keys.

**Step 3: Add localized strings**

Add plain-language strings in all three locale dictionaries. Keep the README English-only; this task does not modify it.

**Step 4: Implement `PadParameterEditor.svelte`**

Use props:

```ts
selectedPad: number | null;
sample: Sample | undefined;
onCommit: (param: PadParameter, value: number) => void;
```

Render one panel directly under the assignment grid:

- Heading identifies the selected pad and sample; use the disabled-state string when no selected assigned pad exists.
- Render four keyboard-focusable rotary controls with a knurled rim, active indicator, localized label, current value, and an accessible value/range name.
- Mouse drag starts on a knob, adjusts from vertical delta, calls `clampPadParameter`, and commits through `onCommit`; release removes window listeners.
- Clicking or focusing a knob selects its parameter and synchronizes the single text field.
- Text field: Enter and blur parse then commit valid integer values; Escape restores the value captured on focus; invalid values remain uncommitted and show the valid range.
- Apply `disabled`/`aria-disabled` styling when `selectedPad` is null or `sample` is absent. Do not persist settings for an empty pad.
- Use existing theme variables only. Do not use emoji.

**Step 5: Verify type checking and locales**

Run:

```bash
pnpm test src/lib/i18n.test.ts
pnpm check
```

Expected: both pass with no new warnings from the editor.

### Task 3: Integrate with the existing synchronized pad selection

**Files:**
- Modify: `src/components/DeviceView.svelte`

**Step 1: Extend the E2E test before integration**

In `tests/e2e/critical.spec.ts`, add a new test using the existing WAV-folder Tauri mock. Assert that the editor starts disabled, becomes enabled after selecting an assigned row, and updates when selecting the matching physical pad.

**Step 2: Verify the new E2E test is red**

Run:

```bash
pnpm exec playwright test tests/e2e/critical.spec.ts --grep "Pad parameter editor"
```

Expected: FAIL because the editor does not render.

**Step 3: Wire the editor**

- Import `setParam` from `src/stores/app.ts` and `PadParameterEditor`.
- Derive the sample from `$project.kit.pads[selectPad]`.
- Render `PadParameterEditor` immediately after the assignment list within `assignment-panel`.
- Pass `selectPad`, selected sample, and an `onCommit` callback calling `setParam(selectPad, param, value)` only when an assigned pad remains selected.
- Do not change existing selection, drag/drop, preview, delete, or arrow-navigation logic.

**Step 4: Verify the integration E2E test**

Run:

```bash
pnpm exec playwright test tests/e2e/critical.spec.ts --grep "Pad parameter editor"
```

Expected: PASS for disabled state and selection synchronization.

### Task 4: Verify mouse and keyboard editing behavior

**Files:**
- Modify: `tests/e2e/critical.spec.ts`

**Step 1: Extend the focused E2E scenario**

Assert the approved interaction contract:

- Clicking a rotary control activates it and shows its current value in the single input.
- A vertical mouse drag changes the value while respecting bounds.
- Typing a valid value then pressing Enter applies it.
- Typing a valid value then leaving the field applies it.
- Typing a value and pressing Escape restores the pre-edit value.
- Invalid, fractional, or out-of-range input does not change the assigned sample.

**Step 2: Run focused E2E validation**

Run:

```bash
pnpm exec playwright test tests/e2e/critical.spec.ts --grep "Pad parameter editor"
```

Expected: PASS.

### Task 5: Full verification and visual review

**Files:**
- Modify only if a test exposes a defect in the new editor.

**Step 1: Run all automated validation**

Run:

```bash
pnpm test
pnpm check
pnpm exec playwright test tests/e2e/critical.spec.ts
PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

Expected: all tests pass; `pnpm check` has no errors; only documented pre-existing warnings remain.

**Step 2: Capture visual evidence**

Start the local Vite app, use the existing Tauri mock to assign a WAV, and capture screenshots showing:

1. Disabled panel without a selected assigned pad.
2. Active panel with the four knurled rotary controls and an active Pitch input.
3. A changed parameter value after mouse drag and keyboard entry.

Inspect the screenshots for clipping, contrast, selection clarity, and responsive layout.

**Step 3: Run a fresh new-user usability review**

Ask a fresh reviewer to assess discoverability of pad selection, clarity of disabled state, knob affordance, keyboard-field workflow, and range messaging. Fix mandatory findings before delivery.

**Step 4: Review and handoff**

Run a final spec and code-quality review. Do not commit, stage, or push unless the user explicitly requests it.
