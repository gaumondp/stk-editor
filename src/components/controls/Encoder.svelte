<svelte:options runes />

<script lang="ts">
	interface Props {
		id: string;
		x: number;
		y: number;
		radius: number;
		label: string;
		detents: number;
		value: number;
		onChange?: (id: string, delta: number) => void;
		onPress?: (id: string) => void;
	}

	let { id, x, y, radius, label, detents, value, onChange, onPress }: Props = $props();

	let center = $derived(radius);
	let diameter = $derived(radius * 2);
	let detentAngle = $derived(360 / detents);
	let indicatorAngle = $derived((value * detentAngle - 90) * Math.PI / 180);
	let indicatorX = $derived(center + radius * 0.55 * Math.cos(indicatorAngle));
	let indicatorY = $derived(center + radius * 0.55 * Math.sin(indicatorAngle));
	let ticks = $derived(
		Array.from({ length: detents }, (_, i) => {
			const a = (i * 360 / detents - 90) * Math.PI / 180;
			return {
				x1: center + (radius - 6) * Math.cos(a),
				y1: center + (radius - 6) * Math.sin(a),
				x2: center + (radius - 2) * Math.cos(a),
				y2: center + (radius - 2) * Math.sin(a),
				active: i <= (value % detents)
			};
		})
	);

	let isDragging = $state(false);
	let lastAngle = $state(0);
	let accumulated = $state(0);

	function getAngle(e: PointerEvent, svg: SVGSVGElement): number {
		const rect = svg.getBoundingClientRect();
		return Math.atan2(e.clientY - (rect.top + (y + center) * rect.height / 738), e.clientX - (rect.left + (x + center) * rect.width / 635)) * 180 / Math.PI;
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		isDragging = true;
		const svg = (event.currentTarget as Element).closest('svg') as SVGSVGElement;
		lastAngle = getAngle(event, svg);
		accumulated = 0;
		const move = (e: PointerEvent) => {
			if (!isDragging) return;
			let cur = getAngle(e, svg);
			let d = cur - lastAngle;
			if (d > 180) d -= 360;
			if (d < -180) d += 360;
			accumulated += d;
			lastAngle = cur;
			const steps = Math.trunc(accumulated / detentAngle);
			if (steps !== 0) {
				accumulated -= steps * detentAngle;
				onChange?.(id, steps);
			}
		};
		const up = () => {
			isDragging = false;
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}
	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		onChange?.(id, event.deltaY > 0 ? -1 : 1);
	}
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); onChange?.(id, 1); }
		else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); onChange?.(id, -1); }
		else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPress?.(id); }
	}
</script>

<g transform={`translate(${x} ${y})`} class="encoder-group" tabindex="0" role="spinbutton" aria-label={label} aria-valuenow={value}>
	<circle class="encoder-ring" cx={center} cy={center} r={radius - 1} />
	{#each ticks as tick}
		<line class="encoder-tick {tick.active ? 'active' : ''}" x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} />
	{/each}
	<circle class="encoder-body" cx={center} cy={center} r={radius * 0.72} />
	<line class="encoder-indicator" x1={center} y1={center} x2={indicatorX} y2={indicatorY} />
	<circle class="encoder-center" cx={center} cy={center} r={radius * 0.12} />
	<text class="encoder-label" x={center} y={diameter + 16} text-anchor="middle" font-size="10">{label}</text>
	<circle class="encoder-hit" cx={center} cy={center} r={radius} onpointerdown={handlePointerDown} onwheel={handleWheel} onkeydown={handleKeyDown} />
</g>

<style>
	.encoder-group { cursor: grab; user-select: none; }
	.encoder-group:active { cursor: grabbing; }
	.encoder-group:focus { outline: none; }
	.encoder-group:focus-visible .encoder-ring { stroke: var(--accent, #d2a83f); stroke-width: 2; }
	.encoder-ring { fill: var(--bg-2, #23272b); stroke: var(--line, #3a3f45); stroke-width: 1.5; }
	.encoder-tick { stroke: var(--fg-dim, #9aa0a6); stroke-width: 1.5; opacity: 0.4; }
	.encoder-tick.active { stroke: var(--accent, #d2a83f); opacity: 1; }
	.encoder-body { fill: var(--bg-3, #2e3338); stroke: var(--line, #3a3f45); stroke-width: 1; }
	.encoder-indicator { stroke: var(--accent, #d2a83f); stroke-width: 2.5; stroke-linecap: round; }
	.encoder-center { fill: var(--fg-dim, #9aa0a6); }
	.encoder-label { fill: var(--fg-dim, #9aa0a6); font-family: 'Courier New', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
	.encoder-hit { fill: transparent; cursor: grab; }
</style>
