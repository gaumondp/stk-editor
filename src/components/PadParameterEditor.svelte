<script lang="ts">
	import type { Sample } from '../lib/commands';
	import { t, tr } from '../lib/i18n';
	import {
		PAD_PARAMETERS,
		clampPadParameter,
		parsePadParameter,
		type PadParameter,
		type PadParameterMeta
	} from '../lib/pad-parameters';

	let {
		selectedPad,
		sample,
		onCommit
	}: {
		selectedPad: number | null;
		sample: Sample | undefined;
		onCommit: (param: PadParameter, value: number) => void;
	} = $props();

	// Fixed left-to-right order of the four mixer knobs.
	const PARAM_ORDER: readonly PadParameter[] = ['volume', 'pan', 'pitch', 'fx_send'];
	// Drag sensitivity: full range travels over this many vertical pixels.
	const DRAG_RANGE_PX = 200;

	const enabled = $derived(selectedPad !== null && sample !== undefined);

	// The parameter whose value the single text field edits.
	let activeParam = $state<PadParameter>('volume');
	// Text mirror of the active parameter's value; committed on Enter/blur.
	let fieldValue = $state('');
	// Value captured when the field gained focus, restored on Escape.
	let fieldValueOnFocus = '';
	// True while a typed value fails parsing, to show the range hint.
	let showInvalid = $state(false);

	// Live value for one parameter straight from the sample (0 when disabled).
	function paramValue(param: PadParameter): number {
		return sample ? sample[param] : 0;
	}

	/** Returns the plain-language display text for a parameter's current value. */
	function displayParameterValue(param: PadParameter, value: number): string {
		if (param === 'volume') return `${value}%`;
		if (param === 'pan') {
			if (value === 0) return tr('pad.parameter_pan_center');
			return tr(value < 0 ? 'pad.parameter_pan_left' : 'pad.parameter_pan_right', {
				value: Math.abs(value)
			});
		}
		const unit = PAD_PARAMETERS[param].unit;
		return `${value}${unit ? ` ${unit}` : ''}`;
	}

	const activeValue = $derived(paramValue(activeParam));

	// Keep the text field synced with the active parameter's live value. While
	// the field is focused we only preserve text the USER actually typed
	// (fieldDirty); a knob drag or keyboard nudge on the active parameter still
	// refreshes the field so blur can never re-commit a stale draft.
	let fieldFocused = false;
	let fieldDirty = false;
	$effect(() => {
		// Re-run whenever the active parameter or its live value changes.
		const value = activeValue;
		if (!fieldFocused || !fieldDirty) {
			fieldValue = enabled ? String(value) : '';
			showInvalid = false;
		}
	});

	// Mirror a knob-driven value into the field unless the user is typing a draft.
	function syncFieldToValue(value: number): void {
		if (fieldDirty) return;
		fieldValue = String(value);
		fieldValueOnFocus = fieldValue;
		showInvalid = false;
	}

	function selectParam(param: PadParameter): void {
		if (!enabled) return;
		activeParam = param;
		showInvalid = false;
		if (!fieldFocused || !fieldDirty) {
			fieldValue = String(paramValue(param));
			fieldDirty = false;
		}
	}

	function commitField(): void {
		if (!enabled) return;
		const meta = PAD_PARAMETERS[activeParam];
		const parsed = parsePadParameter(fieldValue, meta);
		if (parsed === null) {
			showInvalid = true;
			return;
		}
		showInvalid = false;
		if (parsed !== paramValue(activeParam)) onCommit(activeParam, parsed);
		fieldValue = String(parsed);
		fieldValueOnFocus = fieldValue;
		fieldDirty = false;
	}

	function onFieldInput(): void {
		// The value the user is now typing differs from the last synced value.
		fieldDirty = true;
	}

	function onFieldFocus(): void {
		fieldFocused = true;
		fieldValueOnFocus = fieldValue;
		fieldDirty = false;
	}

	function onFieldBlur(): void {
		fieldFocused = false;
		// Only a genuinely edited draft commits; an untouched field just resyncs
		// to the live value so a stale draft can never revert a knob edit.
		if (fieldDirty) {
			commitField();
		} else {
			fieldValue = enabled ? String(paramValue(activeParam)) : '';
			showInvalid = false;
		}
	}

	function onFieldKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitField();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			fieldValue = fieldValueOnFocus;
			fieldDirty = false;
			showInvalid = false;
		}
	}

	// ---- rotary drag (vertical: up increases, down decreases) ----

	let dragParam: PadParameter | null = null;
	let dragStartY = 0;
	let dragStartValue = 0;
	// The pad selected when the drag began. If selectedPad changes mid-drag
	// (global arrow navigation, physical-pad click), the drag's dragStartValue
	// no longer belongs to the current pad, so it must terminate rather than
	// write a stale value into the newly selected pad via onCommit.
	let dragStartPad: number | null = null;

	function onKnobPointerDown(event: PointerEvent, param: PadParameter): void {
		if (!enabled) return;
		event.preventDefault();
		selectParam(param);
		dragParam = param;
		dragStartPad = selectedPad;
		dragStartY = event.clientY;
		dragStartValue = paramValue(param);
		window.addEventListener('pointermove', onWindowPointerMove);
		window.addEventListener('pointerup', onWindowPointerUp);
		window.addEventListener('pointercancel', onWindowPointerUp);
	}

	function onWindowPointerMove(event: PointerEvent): void {
		if (dragParam === null) return;
		// The selected pad moved out from under the drag: abandon it so a stale
		// dragStartValue can never be committed against the new pad.
		if (selectedPad !== dragStartPad) {
			onWindowPointerUp();
			return;
		}
		const meta = PAD_PARAMETERS[dragParam];
		const span = meta.max - meta.min;
		// Up (smaller clientY) increases; down decreases.
		const deltaPx = dragStartY - event.clientY;
		const raw = dragStartValue + (deltaPx / DRAG_RANGE_PX) * span;
		const next = clampPadParameter(raw, meta);
		if (next !== paramValue(dragParam)) onCommit(dragParam, next);
		if (dragParam === activeParam) syncFieldToValue(next);
	}

	function onWindowPointerUp(): void {
		dragParam = null;
		dragStartPad = null;
		removeDragListeners();
	}

	function removeDragListeners(): void {
		window.removeEventListener('pointermove', onWindowPointerMove);
		window.removeEventListener('pointerup', onWindowPointerUp);
		window.removeEventListener('pointercancel', onWindowPointerUp);
	}

	// Keyboard nudge on a focused knob: arrows move by 1, PageUp/Down by 10.
	function onKnobKeydown(event: KeyboardEvent, param: PadParameter): void {
		if (!enabled) return;
		const meta = PAD_PARAMETERS[param];
		let step = 0;
		if (event.key === 'ArrowUp' || event.key === 'ArrowRight') step = 1;
		else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') step = -1;
		else if (event.key === 'PageUp') step = 10;
		else if (event.key === 'PageDown') step = -10;
		else return;
		event.preventDefault();
		selectParam(param);
		const next = clampPadParameter(paramValue(param) + step, meta);
		if (next !== paramValue(param)) onCommit(param, next);
		if (param === activeParam) syncFieldToValue(next);
	}

	// Angle for the knob indicator: min -> -135deg, max -> +135deg.
	function knobAngle(param: PadParameter): number {
		const meta = PAD_PARAMETERS[param];
		const span = meta.max - meta.min || 1;
		const ratio = (paramValue(param) - meta.min) / span;
		return -135 + ratio * 270;
	}

	// Clean up any stray listeners if the component unmounts mid-drag.
	$effect(() => () => removeDragListeners());

	const activeMeta = $derived<PadParameterMeta>(PAD_PARAMETERS[activeParam]);
	const headingText = $derived(
		enabled
			? `${tr('pad.parameters_title')} — ${tr('pad.parameter_selected', { pad: selectedPad })}${
					sample?.file_name ? ` · ${sample.file_name}` : ''
				}`
			: tr('pad.parameter_select_audio')
	);
</script>

<section
	class="pad-parameter-editor"
	class:disabled={!enabled}
	aria-label={tr('pad.parameters_title')}
	data-testid="pad-parameter-editor"
>
	<h3 class="ppe-heading" data-testid="pad-parameter-heading">{headingText}</h3>

	<div class="ppe-knobs" role="group" aria-label={tr('pad.parameters_title')}>
		{#each PARAM_ORDER as param (param)}
			{@const meta = PAD_PARAMETERS[param]}
			{@const label = tr(meta.labelKey)}
			{@const value = paramValue(param)}
			<div class="ppe-knob-wrap" class:active={enabled && activeParam === param}>
				<button
					type="button"
					class="ppe-knob"
					data-testid={`pad-knob-${param}`}
					role="slider"
					aria-label={label}
					aria-valuemin={meta.min}
					aria-valuemax={meta.max}
					aria-valuenow={enabled ? value : undefined}
					aria-valuetext={enabled ? displayParameterValue(param, value) : undefined}
					aria-current={enabled && activeParam === param ? 'true' : undefined}
					disabled={!enabled}
					onpointerdown={(e) => onKnobPointerDown(e, param)}
					onkeydown={(e) => onKnobKeydown(e, param)}
					onclick={() => selectParam(param)}
				>
					<span class="ppe-knob-rim" style={`--ppe-angle: ${knobAngle(param)}deg`}>
						<span class="ppe-knob-indicator"></span>
					</span>
				</button>
				<span class="ppe-knob-label">{label}</span>
				<span class="ppe-knob-value" data-testid={`pad-knob-value-${param}`}>
					{enabled ? displayParameterValue(param, value) : '—'}
				</span>
			</div>
		{/each}
	</div>

	{#if enabled}
		<p class="ppe-interaction-hint" data-testid="pad-parameter-interaction-hint">
			{tr('pad.parameter_drag_hint')}
		</p>
	{/if}

	<div class="ppe-field-row" class:active={enabled}>
		<label class="ppe-field-label" for="pad-parameter-field">
			{tr('pad.parameter_value_for', { parameter: tr(activeMeta.labelKey) })}
		</label>
		<input
			id="pad-parameter-field"
			class="ppe-field"
			class:invalid={showInvalid}
			data-testid="pad-parameter-field"
			type="text"
			inputmode="numeric"
			autocomplete="off"
			bind:value={fieldValue}
			disabled={!enabled}
			aria-invalid={showInvalid}
			aria-describedby={showInvalid ? 'pad-parameter-hint' : undefined}
			onfocus={onFieldFocus}
			oninput={onFieldInput}
			onblur={onFieldBlur}
			onkeydown={onFieldKeydown}
		/>
	</div>
	{#if enabled && showInvalid}
		<p class="ppe-hint" id="pad-parameter-hint" role="alert" data-testid="pad-parameter-hint">
			{t('pad.parameter_invalid', { min: activeMeta.min, max: activeMeta.max })}
		</p>
	{/if}
</section>

<style>
	.pad-parameter-editor {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: var(--radius, 6px);
		background: var(--bg-2);
		color: var(--fg);
	}

	.pad-parameter-editor.disabled {
		opacity: 0.55;
	}

	.ppe-heading {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--fg);
	}

	.ppe-knobs {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}

	.ppe-knob-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		min-width: 72px;
	}

	.ppe-knob {
		width: 52px;
		height: 52px;
		padding: 0;
		border: none;
		background: transparent;
		cursor: ns-resize;
		touch-action: none;
	}

	.pad-parameter-editor.disabled .ppe-knob {
		cursor: default;
	}

	.ppe-knob:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
		border-radius: 50%;
	}

	.ppe-knob-rim {
		position: relative;
		display: block;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: var(--bg);
		border: 2px solid var(--line);
		/* Knurled outer rim, drawn with a conic gradient of thin ridges. */
		background-image: repeating-conic-gradient(
			var(--line) 0deg 4deg,
			transparent 4deg 8deg
		);
		transform: rotate(var(--ppe-angle, 0deg));
		transition: transform 60ms linear;
	}

	.ppe-knob-wrap.active .ppe-knob-rim {
		border-color: var(--accent);
	}

	.ppe-knob-indicator {
		position: absolute;
		top: 4px;
		left: 50%;
		width: 3px;
		height: 16px;
		margin-left: -1.5px;
		border-radius: 2px;
		background: var(--accent);
	}

	.ppe-knob-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--fg);
	}

	.ppe-knob-value {
		font-size: 12px;
		color: var(--fg-dim);
		font-variant-numeric: tabular-nums;
	}

	.ppe-interaction-hint {
		margin: 0;
		font-size: 12px;
		color: var(--fg-dim);
	}

	.ppe-field-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border: 1px solid transparent;
		border-radius: var(--radius, 6px);
	}

	.ppe-field-row.active {
		border-color: var(--accent);
		box-shadow: inset 3px 0 var(--accent);
	}

	.ppe-field-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--fg);
	}

	.ppe-field-row.active .ppe-field-label {
		color: var(--accent);
	}

	.ppe-field {
		width: 96px;
		padding: 6px 8px;
		border: 1px solid var(--line);
		border-radius: var(--radius, 6px);
		background: var(--bg);
		color: var(--fg);
		font-variant-numeric: tabular-nums;
	}

	.ppe-field:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.ppe-field.invalid {
		border-color: var(--err);
	}

	.ppe-hint {
		margin: 0;
		font-size: 12px;
		color: var(--err);
	}
</style>
