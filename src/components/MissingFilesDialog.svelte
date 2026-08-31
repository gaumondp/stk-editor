<svelte:options runes />

<script lang="ts">
	import { tr } from '../lib/i18n';
	import { api } from '../lib/commands';
	import { project, projectPath, relink } from '../stores/app';
	import { focusTrap } from '../lib/focusTrap';
	import { dismissable } from '../lib/dismissable';

	let {
		open = false,
		onClose = () => {}
	}: {
		open: boolean;
		onClose: () => void;
	} = $props();

	let missing = $state<
		Array<{
			pad: number;
			file_name: string;
			original_path: string;
			sha256: string | null;
			candidates: string[];
			loading: boolean;
		}>
	>([]);
	let loading = $state(false);

	async function load() {
		loading = true;
		const p = $project;
		const path = $projectPath ?? '';
		if (!p) {
			missing = [];
			loading = false;
			return;
		}
		try {
			await api.findMissing(p, path);
			const unresolved = Object.entries(p.kit.pads)
				.filter(([, s]) => {
					const ok = s.resolved_path ? true : false;
					// Check if file_name exists but resolved_path missing or not exists
					return s.file_name && !ok;
				})
				.map(([padStr, s]) => ({
					pad: Number(padStr),
					file_name: s.file_name,
					original_path: s.original_path,
					candidates: [] as string[],
					loading: true,
					sha256: s.sha256 ?? null
				}));

			missing = unresolved;

			// Fetch candidates for each
			for (const item of missing) {
				try {
					const cands = await api.searchCandidates(item.file_name, path || '.', item.sha256);
					item.candidates = cands.slice(0, 8);
				} catch {
					item.candidates = [];
				} finally {
					item.loading = false;
					missing = [...missing];
				}
			}
		} catch {
			missing = [];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open) void load();
	});

	async function pick(pad: number, candidate: string) {
		await relink(pad, candidate, true);
		await load();
	}

	async function pickManual(pad: number) {
		const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
		const picked = await openDialog({ filters: [{ name: 'WAV', extensions: ['wav'] }] });
		if (!picked) return;
		await relink(pad, picked as string, true);
		await load();
	}

	function handleBackdrop(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains('backdrop')) onClose();
	}
</script>

{#if open}
	<div class="backdrop" role="presentation" onclick={handleBackdrop}>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label={tr('missing.title')}
			tabindex="-1"
			use:focusTrap
			use:dismissable={onClose}
		>
			<h2>{tr('missing.title')} ({missing.length})</h2>
			{#if loading}
				<p class="hint">{tr('missing.searching')}</p>
			{/if}
			{#if !loading && !missing.length}
				<p class="hint">{tr('missing.none')}</p>
			{/if}
			<ul class="list">
				{#each missing as item (item.pad)}
					<li class="row">
						<div class="head">
							<span class="pad">Pad {item.pad}</span>
							<span class="file" title={item.original_path}>{item.file_name}</span>
							<span class="orig" title={item.original_path}>{item.original_path}</span>
						</div>
						{#if item.loading}
							<span class="hint">{tr('missing.searching_candidates')}</span>
						{:else if item.candidates.length}
							<ul class="cands">
								{#each item.candidates as c}
									<li>
										<button class="cand" type="button" onclick={() => pick(item.pad, c)} title={c}>{c}</button>
									</li>
								{/each}
							</ul>
						{:else}
							<span class="hint">{tr('missing.no_candidates')}</span>
						{/if}
						<button class="btn small" type="button" onclick={() => pickManual(item.pad)}
							>{tr('missing.choose_file')}</button
						>
					</li>
				{/each}
			</ul>
			<div class="actions">
				<button class="btn primary" type="button" onclick={onClose}>{tr('missing.close')}</button>
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
		padding: 18px;
		min-width: 520px;
		max-width: 720px;
		max-height: 80vh;
		overflow: auto;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
	}
	h2 {
		margin: 0 0 8px;
		font-size: 16px;
	}
	.hint {
		font-size: 12px;
		color: var(--fg-dim, #9aa0a6);
		margin: 6px 0;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 8px 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.row {
		border: 1px solid var(--line, #3a3f45);
		border-radius: 8px;
		padding: 8px 10px;
		background: var(--bg, #1a1d21);
	}
	.head {
		display: flex;
		gap: 8px;
		align-items: baseline;
		flex-wrap: wrap;
	}
	.pad {
		font-weight: 600;
		color: var(--accent, #d2a83f);
		min-width: 60px;
	}
	.file {
		font-weight: 600;
	}
	.orig {
		font-size: 11px;
		color: #e74c3c;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	.cands {
		list-style: none;
		padding: 4px 0 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 120px;
		overflow: auto;
	}
	.cand {
		width: 100%;
		text-align: left;
		background: var(--bg-3, #2e3338);
		border: 1px solid var(--line);
		border-radius: 4px;
		padding: 4px 8px;
		font-size: 11px;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cand:hover {
		background: #39414b;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 12px;
	}
	.btn {
		padding: 6px 12px;
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
	.btn.small {
		padding: 2px 8px;
		font-size: 11px;
		margin-top: 6px;
	}
</style>
