<svelte:options runes />

<script lang="ts">
	import { focusTrap } from '../lib/focusTrap';
	import bundledReadme from '../../README.md?raw';

	let { open = false, onClose = () => {} }: { open: boolean; onClose: () => void } = $props();

	let content = $state<string>('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		content = bundledReadme;
		loading = false;
	}

	$effect(() => {
		if (open) void load();
	});

	function handleBackdrop(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains('backdrop')) onClose();
	}

	function escapeHtml(value: string): string {
		return value.replace(/[&<>"']/g, (character) => ({
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		})[character] ?? character);
	}

	// Small, local-only Markdown renderer. Escape text before adding its own tags.
	function renderMarkdown(md: string): string {
		let html = escapeHtml(md)
			.replace(/^### (.*$)/gim, '<h3>$1</h3>')
			.replace(/^## (.*$)/gim, '<h2>$1</h2>')
			.replace(/^# (.*$)/gim, '<h1>$1</h1>')
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/`([^`]+)`/g, '<code>$1</code>')
			.replace(/^\- (.*$)/gim, '<li>$1</li>');
		// Wrap loose li
		html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');
		html = html.replace(/<\/ul>\n<ul>/g, '');
		html = html.replace(/\n/g, '<br/>');
		return html;
	}
</script>

{#if open}
	<div class="backdrop" role="dialog" aria-modal="true" tabindex="-1" onclick={handleBackdrop}>
		<div class="modal" use:focusTrap>
			<div class="header">
				<h2>README</h2>
				<button class="close" type="button" onclick={onClose} aria-label="Close">×</button>
			</div>
			{#if loading}
				<p class="hint">Loading…</p>
			{:else if error}
				<p class="hint">{error}</p>
			{/if}
			<div class="content">
				{@html renderMarkdown(content)}
			</div>
			<div class="actions">
				<button class="btn" type="button" onclick={onClose}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 230; }
	.modal { background: var(--bg-2, #23272b); border: 1px solid var(--line, #3a3f45); border-radius: 12px; width: min(800px, 90vw); max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,.5); }
	.header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px 0; }
	h2 { margin: 0; font-size: 18px; }
	.close { background: none; border: none; color: var(--fg-dim); font-size: 22px; cursor: pointer; }
	.content { padding: 12px 20px; overflow: auto; flex: 1; font-size: 13px; line-height: 1.6; }
	.content :global(h1) { font-size: 20px; margin: 16px 0 8px; }
	.content :global(h2) { font-size: 16px; margin: 12px 0 6px; }
	.content :global(code) { background: var(--bg-3, #2e3338); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 12px; }
	.content :global(pre) { background: var(--bg, #1a1d21); padding: 8px; border-radius: 6px; overflow: auto; }
	.content :global(ul) { padding-left: 20px; }
	.actions { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--line, #3a3f45); }
	.btn { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg-3, #2e3338); color: var(--fg); cursor: pointer; text-decoration: none; font-size: 13px; }
	.btn.primary { background: var(--accent, #d2a83f); color: #1a1d21; border-color: var(--accent); font-weight: 600; }
	.hint { padding: 0 20px; font-size: 12px; color: var(--fg-dim); }
</style>
