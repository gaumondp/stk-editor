<svelte:options runes />

<script lang="ts">
	import { focusTrap } from '../lib/focusTrap';
	import { dismissable } from '../lib/dismissable';
	import { tr } from '../lib/i18n';

	const { open = false, onConfirm = () => {} } = $props<{
		open: boolean;
		onConfirm: (choice: 'save' | 'discard' | 'cancel' | null) => void;
	}>();
</script>

{#if open}
	<div class="backdrop" role="alertdialog" aria-modal="true">
		<div class="modal" tabindex="-1" use:focusTrap use:dismissable={() => onConfirm('cancel')}>
			<h2>{tr('unsaved.title')}</h2>
			<p>{tr('unsaved.body')}</p>
			<div class="actions">
				<button class="btn" type="button" onclick={() => onConfirm('cancel')}>{tr('unsaved.cancel')}</button>
				<button class="btn" type="button" onclick={() => onConfirm('discard')}>{tr('unsaved.discard')}</button>
				<button class="btn primary" type="button" onclick={() => onConfirm('save')}>{tr('unsaved.save')}</button>
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
		z-index: 300;
	}
	.modal {
		background: var(--bg-2, #23272b);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 10px;
		padding: 20px;
		min-width: 360px;
		max-width: 480px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
	}
	.actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}
	.btn {
		background: var(--bg-3, #2e3338);
		color: var(--fg, #e6e6e6);
		border: 1px solid var(--line, #3a3f45);
		padding: 6px 14px;
		border-radius: 4px;
		cursor: pointer;
	}
	.btn.primary {
		background: var(--accent, #d2a83f);
		color: #1a1d21;
		border-color: var(--accent, #d2a83f);
	}
</style>
