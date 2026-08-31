<svelte:options runes />

<script lang="ts">
	import { focusTrap } from '../lib/focusTrap';
	import { dismissable } from '../lib/dismissable';
	import { tr } from '../lib/i18n';
	import { api } from '../lib/commands';

	const APP_VERSION = (import.meta.env.APP_VERSION as string) ?? '0.1.0';
	const APP_BUILD_TIME = (import.meta.env.APP_BUILD_TIME as string) ?? '';

	let { open = false, onClose = () => {} }: { open: boolean; onClose: () => void } = $props();

	let diagnostic = $state<string>('');
	let copied = $state(false);
	let copyError = $state<string | null>(null);

	/**
	 * Fetches the reproducible diagnostic report from the backend and copies it
	 * to the clipboard. Falls back to an inline error message on failure.
	 * @returns {Promise<void>}
	 */
	async function copyDiagnostics(): Promise<void> {
		copied = false;
		copyError = null;
		try {
			const details = await api.diagnostics();
			diagnostic = `STK Forge ${details.app_version}\nBuild: ${APP_BUILD_TIME || 'unknown'}\nOS: ${details.os}\nCPU: ${details.cpu}\nArchitecture: ${details.arch}\nRAM: ${details.ram_bytes} bytes`;
			await navigator.clipboard.writeText(diagnostic);
			copied = true;
		} catch (e) {
			copyError = String(e);
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if ((event.target as HTMLElement).classList.contains('backdrop')) onClose();
	}
</script>

{#if open}
	<div class="backdrop" role="presentation" onclick={handleBackdropClick}>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label={tr('menu.about')}
			tabindex="-1"
			use:focusTrap
			use:dismissable={onClose}
		>
			<h2>{tr('about.title')}</h2>
			<p class="ver">{tr('about.version', { version: APP_VERSION })}</p>
			{#if APP_BUILD_TIME}
				<p class="build">{tr('about.build_time', { time: APP_BUILD_TIME })}</p>
			{/if}

			<p class="body">{tr('about.description')}</p>
			<p class="body compatibility">{tr('about.compatibility')}</p>

			<p class="developed-by">{tr('about.developed_by')}</p>

			<ul class="meta">
				<li>{tr('about.license')}</li>
				<li>{tr('about.repo')}</li>
				<li>{tr('about.disclaimer')}</li>
			</ul>

			<div class="diagnostics">
				<button class="btn" type="button" onclick={copyDiagnostics}>
					{tr('about.copy_diagnostics')}
				</button>
				{#if copied}
					<span class="hint ok">{tr('about.diagnostics_copied')}</span>
				{/if}
				{#if copyError}
					<span class="hint err">{copyError}</span>
				{/if}
			</div>

			<div class="actions">
				<button class="btn primary" type="button" onclick={onClose}>{tr('about.ok')}</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 220;
	}
	.modal {
		background: var(--bg-2, #23272b);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 12px;
		padding: 22px;
		min-width: 380px;
		max-width: 520px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
	}
	h2 {
		margin: 0 0 6px;
		font-size: 18px;
	}
	.ver {
		color: var(--fg-dim, #9aa0a6);
		font-size: 12px;
		margin: 0 0 2px;
		font-family: monospace;
	}
	.build {
		color: var(--fg-dim, #9aa0a6);
		font-size: 12px;
		margin: 0 0 12px;
		font-family: monospace;
	}
	.body {
		font-size: 13px;
		line-height: 1.5;
		color: var(--fg, #e6e6e6);
	}
	.developed-by {
		font-size: 12px;
		color: var(--fg, #e6e6e6);
		margin: 8px 0 0;
	}
	.meta {
		font-size: 11px;
		color: var(--fg-dim, #9aa0a6);
		margin: 12px 0 0;
		padding-left: 16px;
	}
	.diagnostics {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 16px;
		flex-wrap: wrap;
	}
	.hint {
		font-size: 11px;
	}
	.hint.ok {
		color: var(--ok, #4caf50);
	}
	.hint.err {
		color: var(--err, #e74c3c);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 16px;
	}
	.btn {
		padding: 6px 14px;
		border-radius: 6px;
		border: 1px solid var(--line);
		background: var(--bg-3, #2e3338);
		color: var(--fg);
		cursor: pointer;
	}
	.btn.primary {
		background: var(--accent, #d2a83f);
		color: #1a1d21;
		border-color: var(--accent);
		font-weight: 600;
	}
</style>
