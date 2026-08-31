<svelte:options runes />

<script lang="ts">
	import { toasts } from '../stores/notify';
	import { tr } from '../lib/i18n';

	function dismiss(id: number) {
		toasts.update((t) => t.filter((x) => x.id !== id));
	}
</script>

<div class="toast-host" aria-live="polite" aria-atomic="false">
	{#each $toasts as toast (toast.id)}
		<div class={`toast ${toast.kind}`} role="status">
			<button type="button" class="toast-dismiss" onclick={() => dismiss(toast.id)} aria-label={tr('common.close')}>
				{toast.msg}
			</button>
		</div>
	{/each}
</div>

<style>
	.toast-host {
		position: fixed;
		bottom: 12px;
		right: 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		z-index: 400;
		pointer-events: none;
	}
	.toast {
		pointer-events: auto;
		padding: 8px 12px;
		border-radius: 6px;
		border: 1px solid var(--line, #3a3f45);
		background: var(--bg-3, #2e3338);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		min-width: 200px;
		max-width: 360px;
		font-size: 13px;
		cursor: pointer;
		animation: slideIn 0.2s ease-out;
	}
	.toast-dismiss {
		display: block;
		width: 100%;
		box-sizing: border-box;
		text-align: left;
		font: inherit;
		color: inherit;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
	}
	.toast.success {
		border-color: var(--ok, #4caf50);
	}
	.toast.error {
		border-color: var(--err, #e74c3c);
	}
	.toast.warn {
		border-color: var(--warn, #f0ad4e);
	}
	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
</style>
