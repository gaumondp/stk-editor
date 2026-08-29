<svelte:options runes />

<script lang="ts">
	interface Props {
		id: string;
		x: number;
		y: number;
		radius: number;
		label: string;
		min: number;
		max: number;
		value: number;
		defaultValue: number;
		unit?: string;
		onChange?: (id: string, value: number) => void;
		onDoubleClick?: (id: string) => void;
	}

	let { id, x, y, radius, label, min, max, value, defaultValue, unit = '', onChange, onDoubleClick }: Props = $props();

	let center = $derived(radius);
	let diameter = $derived(radius * 2);
	let normalizedValue = $derived((value - min) / (max - min));
	let currentAngle = $derived(-135 + normalizedValue * 270);
	let indicatorX = $derived(center + (radius * 0.6) * Math.cos((currentAngle - 90) * Math.PI / 180));
	let indicatorY = $derived(center + (radius * 0.6) * Math.sin((currentAngle - 90) * Math.PI / 180));
	let valueDisplay = $derived(unit ? `${value} ${unit}` : String(value));

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		const svg = (event.currentTarget as Element).closest('svg') as SVGSVGElement | null;
		if (!svg) return;
		const handleMove = (e: PointerEvent) => {
			const rect = svg.getBoundingClientRect();
			const dx = e.clientX - (rect.left + (x + center) * (rect.width / 635));
			const dy = e.clientY - (rect.top + (y + center) * (rect.height / 738));
			let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
			if (angle < 0) angle += 360;
			let clamped = angle;
			if (clamped > 225 && clamped < 315) clamped = clamped < 270 ? 225 : 315;
			let norm = (clamped + 135) / 270;
			norm = Math.max(0, Math.min(1, norm));
			onChange?.(id, Math.round(min + norm * (max - min)));
		};
		const handleUp = () => {
			window.removeEventListener('pointermove', handleMove);
			window.removeEventListener('pointerup', handleUp);
		};
		window.addEventListener('pointermove', handleMove);
		window.addEventListener('pointerup', handleUp);
	}
	function handleDoubleClick() {
		onDoubleClick?.(id);
		onChange?.(id, defaultValue);
	}
	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		const delta = event.deltaY > 0 ? -1 : 1;
		const step = (max - min) / 100;
		onChange?.(id, Math.round(Math.max(min, Math.min(max, value + delta * step))));
	}
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
			event.preventDefault();
			onChange?.(id, Math.round(Math.min(max, value + (max - min) / 100)));
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
			event.preventDefault();
			onChange?.(id, Math.round(Math.max(min, value - (max - min) / 100)));
		}
	}
</script>

<g transform={`translate(${x} ${y})`} class="knob-group" tabindex="0" role="slider" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}>
	<circle class="knob-ring" cx={center} cy={center} r={radius - 2} />
	<line class="knob-indicator" x1={center} y1={center} x2={indicatorX} y2={indicatorY} />
	<circle class="knob-center" cx={center} cy={center} r={radius * 0.15} />
	<text class="knob-label" x={center} y={diameter + 18} text-anchor="middle" font-size="10">{label}</text>
	<text class="knob-value" x={center} y={diameter + 32} text-anchor="middle" font-size="11" font-weight="600">{valueDisplay}</text>
	<circle class="knob-hit" cx={center} cy={center} r={radius} onpointerdown={handlePointerDown} ondblclick={handleDoubleClick} onwheel={handleWheel} onkeydown={handleKeyDown} />
</g>

<style>
	.knob-group { cursor: grab; user-select: none; }
	.knob-group:active { cursor: grabbing; }
	.knob-group:focus { outline: none; }
	.knob-group:focus-visible .knob-ring { stroke: var(--accent, #d2a83f); stroke-width: 2; }
	.knob-ring { fill: var(--bg-3, #2e3338); stroke: var(--line, #3a3f45); stroke-width: 2; }
	.knob-indicator { stroke: var(--fg, #e6e6e6); stroke-width: 2.5; stroke-linecap: round; }
	.knob-center { fill: var(--fg-dim, #9aa0a6); }
	.knob-label { fill: var(--fg-dim, #9aa0a6); font-family: 'Courier New', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
	.knob-value { fill: var(--fg, #e6e6e6); font-family: 'Courier New', monospace; }
	.knob-hit { fill: transparent; cursor: grab; }
</style>
