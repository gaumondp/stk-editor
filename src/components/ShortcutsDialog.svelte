<svelte:options runes />

<script lang="ts">
	import { focusTrap } from '../lib/focusTrap';
	import { tr } from '../lib/i18n';

	const { open = false, onClose = () => {} } = $props<{ open: boolean; onClose: () => void }>();

	// spec §16.1 — minimum shortcuts
	const rows: Array<[string, string]> = [
		[tr('menu.new'), 'Cmd/Ctrl+N'],
		[tr('menu.open'), 'Cmd/Ctrl+O'],
		[tr('menu.save'), 'Cmd/Ctrl+S'],
		[tr('menu.save_as'), 'Cmd/Ctrl+Shift+S'],
		[tr('menu.close'), 'Cmd/Ctrl+W'],
		['Undo', 'Cmd/Ctrl+Z'],
		['Redo', 'Cmd/Ctrl+Shift+Z / Ctrl+Y'],
		['Remove sample from pad', 'Cmd/Ctrl+Click'],
		['Preview / stop', 'Space'],
		['Toggle view', 'Cmd/Ctrl+Shift+F'],
		['Help / shortcuts', 'F1'],
		['Cancel / close', 'Escape'],
	];

	function handleBackdropClick(event: MouseEvent) {
		if ((event.target as HTMLElement).classList.contains('backdrop')) {
			onClose();
		}
	}

	function handleModalClick(event: MouseEvent) {
		event.stopPropagation();
	}

	async function copyAsMarkdown() {
		const md = rows.map(([l, k]) => `| ${l} | ${k} |`).join('\n');
		const header = `| Action | Shortcut |\n|---|---|\n`;
		try {
			await navigator.clipboard.writeText(header + md);
		} catch {}
	}
</script>

{#if open}
	<div class="backdrop" role="dialog" aria-modal="true" tabindex="-1" onclick={handleBackdropClick}>
		<div class="modal" use:focusTrap onclick={handleModalClick}>
			<h2>{tr('help.shortcuts')}</h2>
			<ul class="shortcuts">
				{#each rows as [label, keys]}
					<li class="row"><span>{label}</span><kbd>{keys}</kbd></li>
				{/each}
			</ul>
			<div class="actions">
				<button class="btn secondary" type="button" onclick={copyAsMarkdown}>Copy as Markdown</button>
				<button class="btn" type="button" onclick={onClose}>OK</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}
	.modal {
		background: var(--bg-2, #23272b);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 10px;
		padding: 20px;
		min-width: 380px;
		max-width: 540px;
		box-shadow: 0 8px 32px rgba(0,0,0,.5);
	}
	.shortcuts {
		list-style: none;
		padding: 0;
		margin: 12px 0 0;
	}
	.row {
		display: flex;
		justify-content: space-between;
		padding: 5px 0;
		border-bottom: 1px solid var(--line, #3a3f45);
	}
	kbd {
		background: var(--bg-3, #2e3338);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 4px;
		padding: 2px 8px;
		font-family: monospace;
		font-size: 12px;
	}
	.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
	.btn {
		background: var(--accent, #d2a83f);
		color: #1a1d21;
		border: none;
		padding: 6px 16px;
		border-radius: 4px;
		cursor: pointer;
	}
	.btn.secondary { background: var(--bg-3, #2e3338); color: var(--fg, #e6e6e6); border: 1px solid var(--line, #3a3f45); }
</style>