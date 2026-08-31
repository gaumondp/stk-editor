<svelte:options runes />

<script lang="ts">
	import { focusTrap } from '../lib/focusTrap';
	import { dismissable } from '../lib/dismissable';
	import { tr } from '../lib/i18n';
	import { project, setKitName, setNotes } from '../stores/app';

	let { open = false, onClose = () => {} }: { open: boolean; onClose: () => void } = $props();
	let name = $state('');
	let notes = $state('');

	$effect(() => {
		if (open) {
			name = $project.kit.name;
			notes = $project.kit.notes ?? '';
		}
	});

	/** Applies confirmed metadata changes and leaves both inputs unchanged on cancellation. */
	async function saveChanges() {
		if (name !== $project.kit.name) await setKitName(name);
		if (notes !== ($project.kit.notes ?? '')) await setNotes(notes);
		onClose();
	}

	function handleBackdrop(event: MouseEvent) {
		if ((event.target as HTMLElement).classList.contains('backdrop')) onClose();
	}
</script>

{#if open}
	<div class="backdrop" role="presentation" onclick={handleBackdrop}>
		<div
			class="modal"
			role="dialog"
			aria-label={tr('dialog.kit_information')}
			aria-modal="true"
			tabindex="-1"
			use:focusTrap
			use:dismissable={onClose}
		>
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void saveChanges();
				}}
			>
				<h2>{tr('dialog.kit_information')}</h2>
				<label for="kit-name">{tr('kit.name')}</label>
				<input id="kit-name" type="text" bind:value={name} required />
				<label for="kit-notes">{tr('kit.notes')}</label>
				<textarea id="kit-notes" rows="5" bind:value={notes}></textarea>
				<div class="actions">
					<button class="btn" type="button" onclick={onClose}>{tr('common.cancel')}</button>
					<button class="btn primary" type="submit">{tr('common.save_changes')}</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 260;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
	}
	.modal {
		width: min(460px, calc(100vw - 32px));
		display: flex;
		flex-direction: column;
		gap: 7px;
		padding: 22px;
		border: 1px solid var(--line, #3a3f45);
		border-radius: 12px;
		background: var(--bg-2, #23272b);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
	}
	h2 {
		margin: 0 0 5px;
		font-size: 18px;
	}
	label {
		color: var(--fg-dim, #9aa0a6);
		font-size: 12px;
	}
	input,
	textarea {
		box-sizing: border-box;
		width: 100%;
		padding: 7px 8px;
		border: 1px solid var(--line, #3a3f45);
		border-radius: 5px;
		background: var(--bg, #1a1d21);
		color: var(--fg, #e6e6e6);
		font: inherit;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 10px;
	}
	.btn {
		padding: 6px 14px;
		border: 1px solid var(--line, #3a3f45);
		border-radius: 6px;
		background: var(--bg-3, #2e3338);
		color: var(--fg, #e6e6e6);
		cursor: pointer;
	}
	.primary {
		border-color: var(--accent, #d2a83f);
		background: var(--accent, #d2a83f);
		color: #1a1d21;
		font-weight: 600;
	}
</style>
