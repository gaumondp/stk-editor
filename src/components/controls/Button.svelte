<svelte:options runes />

<script lang="ts">
	interface Props {
		id: string;
		x: number;
		y: number;
		width: number;
		height: number;
		label: string;
		variant?: string;
		pressed?: boolean;
		disabled?: boolean;
		onClick?: (id: string, event: MouseEvent) => void;
	}

	let { id, x, y, width, height, label, variant = 'default', pressed = false, disabled = false, onClick }: Props = $props();

	let cx = $derived(width / 2);
	let cy = $derived(height / 2);
	let radius = 6;

	const colors: Record<string, { bg: string; fg: string; accent?: string }> = {
		nav: { bg: '#2e3338', fg: '#e6e6e6' },
		primary: { bg: '#d2a83f', fg: '#1a1d21', accent: '#d2a83f' },
		secondary: { bg: '#23272b', fg: '#9aa0a6' },
		track: { bg: '#3a3f45', fg: '#e6e6e6' },
		modifier: { bg: '#1a1d21', fg: '#f0ad4e' },
		record: { bg: '#7a2f2f', fg: '#fff' },
		play: { bg: '#2f5d3a', fg: '#fff' },
		stop: { bg: '#3a3f45', fg: '#e6e6e6' },
		mode: { bg: '#2e3338', fg: '#4a90d2' },
		kit: { bg: '#2e3338', fg: '#d2a83f' },
		sample: { bg: '#2e3338', fg: '#4a90d2' },
		fx: { bg: '#2e3338', fg: '#f0ad4e' },
		mixer: { bg: '#2e3338', fg: '#4caf50' },
		default: { bg: '#2e3338', fg: '#e6e6e6' }
	};

	let col = $derived(colors[variant] ?? colors.default);

	function handleClick(event: MouseEvent) {
		if (disabled) return;
		onClick?.(id, event);
	}
	function handleKeyDown(event: KeyboardEvent) {
		if (disabled) return;
		if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick?.(id, event as unknown as MouseEvent); }
	}
</script>

<g transform={`translate(${x} ${y})`} class="button-group {`variant-${variant}`} {pressed ? 'pressed' : ''} {disabled ? 'disabled' : ''}" role="button" tabindex={disabled ? -1 : 0} aria-label={label} aria-pressed={pressed} aria-disabled={disabled} onclick={handleClick} onkeydown={handleKeyDown}>
	<rect class="button-shadow" x={2} y={2} width={width} height={height} rx={radius} fill="#000" opacity="0.25" />
	<rect class="button-body" x={0} y={0} width={width} height={height} rx={radius} fill={col.bg} stroke={col.accent ?? '#3a3f45'} stroke-width={pressed ? 2 : 1} />
	<rect class="button-highlight" x={1} y={1} width={width - 2} height={height * 0.45} rx={radius - 1} fill="#fff" opacity={pressed ? 0.08 : 0.04} />
	<text class="button-label" x={cx} y={cy} text-anchor="middle" dominant-baseline="central" fill={col.fg} font-size={label.length > 4 ? 9 : 11} font-weight={variant === 'primary' || variant === 'record' || variant === 'play' ? 700 : 500}>{label}</text>
	{#if pressed}<rect x={0} y={0} width={width} height={height} rx={radius} fill="#000" opacity="0.2" />{/if}
</g>

<style>
	.button-group { cursor: pointer; transition: transform 0.06s, filter 0.1s; }
	.button-group:not(.disabled):hover .button-body { filter: brightness(1.08); }
	.button-group:not(.disabled):active { transform: translateY(1px); }
	.button-group.pressed .button-body { filter: brightness(0.92); }
	.button-group.disabled { opacity: 0.45; cursor: default; }
	.button-group:focus { outline: none; }
	.button-group:focus-visible .button-body { stroke: var(--accent, #d2a83f); stroke-width: 2; }
	.button-body { transition: fill 0.12s, filter 0.12s, stroke 0.12s; }
	.button-label { pointer-events: none; user-select: none; }
	.button-shadow { pointer-events: none; }
	.button-highlight { pointer-events: none; }
</style>
