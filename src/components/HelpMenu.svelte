<svelte:options runes />

<script lang="ts">
	import { tr } from '../lib/i18n';

	let { icon = false, onShortcuts = () => {}, onAbout = () => {} }: {
		icon?: boolean;
		onShortcuts?: () => void;
		onAbout?: () => void;
	} = $props();

	let open = $state(false);
	let section = $state<string | null>(null);

	const sections = [
		{ key: 'help.guide', bodyKey: 'help.guide_body' },
		{ key: 'help.json', bodyKey: 'help.json_body' },
		{ key: 'help.compile_doc', bodyKey: 'help.compile_doc_body' },
		{ key: 'help.sd_doc', bodyKey: 'help.sd_doc_body' },
		{ key: 'help.compatibility', bodyKey: 'help.compatibility_body' },
		{ key: 'help.diagnostic', bodyKey: 'help.diagnostic_body' },
	];
</script>

<div class="help" part="menu">
	<button class:help-icon={icon} class="btn" type="button" onclick={() => (open = !open)} aria-haspopup="listbox" aria-label={icon ? tr('menu.help') : undefined} title={icon ? tr('menu.help') : undefined}>
		{#if icon}?{:else}{tr('menu.help')} ▾{/if}
	</button>
	{#if open}
		<ul class="help-list" part="menu-list" role="listbox">
			<li class="help-item" onclick={() => { open = false; onShortcuts(); }} role="option">
				{tr('help.shortcuts')} <span class="kbd">F1</span>
			</li>
			<li class="help-item" onclick={() => { open = false; onAbout(); }} role="option">
				{tr('help.about')}
			</li>
			<li class="divider"></li>
			{#each sections as s}
				<li class="help-item {section === s.key ? 'active' : ''}"
					onclick={() => (section = section === s.key ? null : s.key)}
					role="option">
					{tr(s.key)}
					{#if section === s.key}
						<div class="body">{tr(s.bodyKey)}</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.help { position: relative; }
	.btn { background: var(--bg-3, #2e3338); color: var(--fg, #e6e6e6); border: 1px solid var(--line, #3a3f45); padding: 4px 10px; border-radius: 4px; cursor: pointer; }
	.help-icon { min-width:31px; font-weight:700; }
	.help-list {
		position: absolute; top: calc(100% + 6px); right: 0; background: var(--bg-2, #23272b);
		border: 1px solid var(--line, #3a3f45); border-radius: 8px;
		box-shadow: 0 10px 28px rgba(0,0,0,.4); min-width: 400px; max-width: 560px;
		max-height: 560px; overflow: auto; list-style: none; margin: 0; padding: 8px; z-index: 50;
	}
	.help-item { padding: 10px 12px; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; line-height: 1.35; }
	.help-item:hover { background: var(--bg-3, #2e3338); }
	.help-item.active { display: block; }
	.divider { height: 1px; background: var(--line, #3a3f45); margin: 8px 4px; }
	.kbd { font-size: 11px; opacity: 0.75; border: 1px solid var(--line); padding: 2px 6px; border-radius: 4px; }
	.body { font-size: 13px; color: var(--fg-2, #c0c0c0); margin: 8px 0 3px; line-height: 1.55; padding-right: 6px; }
</style>
