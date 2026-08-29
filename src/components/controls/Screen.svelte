<svelte:options runes />

<script lang="ts">
	interface Props {
		x: number;
		y: number;
		width: number;
		height: number;
		kitName: string;
		profileName?: string;
		viewMode?: 'full' | 'pads';
	}

	let { x, y, width, height, kitName, profileName = 'SmplTrek', viewMode = 'full' }: Props = $props();
	import { tr } from '../../lib/i18n';
	let isPadsOnly = $derived(viewMode === 'pads');
	const innerPad = 10;
	const borderRadius = 8;
</script>

<g transform={`translate(${x} ${y})`} class="screen-group" class:pads-only={isPadsOnly} aria-label={profileName}>
	<rect x={0} y={0} width={width} height={height} rx={borderRadius} fill="#1a1d21" stroke="#3a3f45" stroke-width="1.5" />
	<rect x={4} y={4} width={width - 8} height={height - 8} rx={borderRadius - 2} fill="#05080a" stroke="#0a0d10" stroke-width="1" />
	<rect x={innerPad} y={innerPad} width={width - innerPad * 2} height={height - innerPad * 2} rx={4} fill="#05080a" stroke="#1a2630" stroke-width="1" />
	{#if !isPadsOnly}
		<text x={innerPad + 8} y={innerPad + 18} fill="#4a90d2" font-family="'Courier New', monospace" font-size="10" font-weight="700" letter-spacing="0.08em">SONICWARE</text>
		<text x={width - innerPad - 8} y={innerPad + 18} text-anchor="end" fill="#9aa0a6" font-family="'Courier New', monospace" font-size="10">SmplTrek</text>
		<line x1={innerPad + 8} y1={innerPad + 26} x2={width - innerPad - 8} y2={innerPad + 26} stroke="#1a2630" stroke-width="1" opacity="0.6" />
		<text x={innerPad + 8} y={innerPad + 42} fill="#d2a83f" font-family="'Courier New', monospace" font-size="11" font-weight="600">{tr('kit.name')}: {kitName || '—'}</text>
		<text x={innerPad + 8} y={height - innerPad - 8} fill="#7a8595" font-family="monospace" font-size="7" opacity="0.7">▪ {profileName} • fw 3.2</text>
	{/if}
</g>

<style>
	.screen-group { filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4)); }
	.screen-group.pads-only { opacity: 0.3; }
</style>
