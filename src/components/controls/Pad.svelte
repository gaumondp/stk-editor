<svelte:options runes />

<script lang="ts">
	import { tr } from '../../lib/i18n';

	interface Props {
		id: number;
		x: number;
		y: number;
		width: number;
		height: number;
		special?: boolean;
		label?: string;
		state?: 'empty' | 'assigned' | 'missing' | 'invalid' | 'disabled' | 'previewing' | 'dragover';
		selected?: boolean;
		sample?: {
			file_name: string;
			original_path?: string;
			resolved_path?: string | null;
		} | null;
		onClick?: (id: number, event: MouseEvent) => void;
		onDoubleClick?: (id: number) => void;
		onKeyDown?: (id: number, event: KeyboardEvent) => void;
		tooltip?: string;
	}

	let {
		id,
		x,
		y,
		width,
		height,
		special = false,
		label = 'TRACK',
		state = 'empty',
		selected = false,
		sample = null,
		onClick,
		onDoubleClick,
		onKeyDown,
		tooltip = ''
	}: Props = $props();

	let isSpecial = $derived(special);
	let isSelected = $derived(selected);
	let isDragover = $derived(state === 'dragover');
	let isPreviewing = $derived(state === 'previewing');

	let className = $derived(
		['pad', `pad-${state}`, isSpecial ? 'pad-special' : '', isSelected ? 'pad-selected' : '', isDragover ? 'pad-dragover' : '', isPreviewing ? 'pad-previewing' : '']
			.filter(Boolean)
			.join(' ')
	);

	function handleClick(event: MouseEvent) {
		if (isSpecial) return;
		onClick?.(id, event);
	}
	function handleKeyDown(event: KeyboardEvent) {
		if (isSpecial) return;
		if (event.key === 'Enter' || event.key === ' ') onKeyDown?.(id, event);
	}
	function handleDoubleClick() {
		if (isSpecial) return;
		onDoubleClick?.(id);
	}
</script>

<g
	class={className}
	transform={`translate(${x} ${y})`}
	data-pad={id}
	role="button"
	tabindex={isSpecial ? -1 : 0}
	aria-label={isSpecial ? tr('pad.disabled') : `Pad ${id}`}
	onclick={handleClick}
	ondblclick={handleDoubleClick}
	onkeydown={handleKeyDown}
>
	{#if tooltip}<title>{tooltip}</title>{/if}
	<rect class="pad-bg" width={width} height={height} rx="4" aria-hidden="true" />
	{#if isSpecial}
		<text class="pad-num" x="6" y="14">{id}</text>
		<text class="pad-name" x={width / 2} y={height / 2} text-anchor="middle" dominant-baseline="central">{label}</text>
	{:else}
		<text class="pad-num" x="6" y="14">{id}</text>
		{#if (state === 'assigned' || state === 'missing') && sample?.file_name}
			<text class="pad-name" x={width / 2} y={height / 2 - 4} text-anchor="middle" dominant-baseline="central">
				{sample.file_name.length > 12 ? sample.file_name.slice(0, 10) + '…' : sample.file_name}
			</text>
			{#if state === 'missing' && sample.original_path}
				<text class="pad-missing-path" x="4" y={height - 4} text-anchor="start" font-size="7" fill="var(--err, #e74c3c)">{sample.original_path}</text>
			{/if}
		{/if}
	{/if}
</g>

<style>
	.pad { cursor: pointer; transition: filter 0.1s, transform 0.05s; }
	.pad:not(.pad-disabled):hover .pad-bg { filter: brightness(1.1); }
	.pad:not(.pad-disabled):active .pad-bg { transform: scale(0.98); }
	.pad-bg { stroke: transparent; stroke-width: 1.5; fill: var(--pad-empty, #3a3f45); transition: fill 0.15s, stroke 0.15s; }
	.pad-assigned .pad-bg { fill: var(--pad-assigned, #2f5d3a); }
	.pad-empty .pad-bg { fill: var(--pad-empty, #3a3f45); }
	.pad-missing .pad-bg { fill: var(--pad-missing, #7a2f2f); }
	.pad-invalid .pad-bg { fill: var(--pad-invalid, #5d3a2f); }
	.pad-disabled .pad-bg { fill: var(--pad-disabled, #2a2d31); opacity: 0.7; }
	.pad-selected .pad-bg { stroke: var(--accent, #d2a83f); stroke-width: 2.5; }
	.pad-dragover .pad-bg { stroke: var(--accent-2, #4a90d2); stroke-width: 2.5; filter: brightness(1.35); }
	.pad-previewing .pad-bg { animation: pulse 1s ease-in-out infinite; }
	@keyframes pulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.3)} }
	.pad-num { fill: var(--fg-dim, #9aa0a6); font-size: 10px; font-family: 'Courier New', monospace; font-weight: 600; }
	.pad-name { fill: var(--fg, #e6e6e6); font-size: 8px; font-family: sans-serif; font-weight: 500; }
	.pad-missing-path { fill: var(--err, #e74c3c); font-size: 7px; font-style: italic; font-family: monospace; }
	.pad-special .pad-name { font-size: 9px; font-weight: 600; fill: var(--fg-dim, #9aa0a6); }
</style>
