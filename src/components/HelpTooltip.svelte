<svelte:options runes />

<script lang="ts">
	let { text = '' }: { text: string } = $props();
	let visible = $state(false);
</script>

<span class="help-tooltip" onmouseenter={() => (visible = true)} onmouseleave={() => (visible = false)} role="note" aria-label={text}>
	<span class="icon" tabindex="0" onfocus={() => (visible = true)} onblur={() => (visible = false)}>?</span>
	{#if visible}
		<span class="bubble" role="tooltip">{text}</span>
	{/if}
</span>

<style>
	.help-tooltip {
		position: relative;
		display: inline-flex;
		align-items: center;
		margin-left: 6px;
	}
	.icon {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--bg-3, #2e3338);
		border: 1px solid var(--line, #3a3f45);
		color: var(--fg-dim, #9aa0a6);
		font-size: 11px;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: help;
	}
	.bubble {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 6px;
		background: var(--bg-3, #2e3338);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 6px;
		padding: 6px 8px;
		font-size: 11px;
		line-height: 1.4;
		white-space: nowrap;
		max-width: 260px;
		white-space: normal;
		box-shadow: 0 4px 12px rgba(0,0,0,0.3);
		z-index: 10;
	}
</style>
