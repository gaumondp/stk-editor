<svelte:options runes />

<script lang="ts">
	import { focusTrap } from '../lib/focusTrap';
	import { dismissable } from '../lib/dismissable';
	import { api } from '../lib/commands';
	import { getLocale, tr } from '../lib/i18n';
	import { success as notifySuccess, error as notifyError } from '../stores/notify';

	let { open = false, onClose = () => {} }: { open: boolean; onClose: () => void } = $props();

	let path = $state<string>('');
	let report = $state<import('../lib/commands').StkInspectReport | null>(null);
	let loading = $state(false);
	let extracting = $state(false);
	let error = $state<string | null>(null);

	// Extraction is only allowed once a valid inspection report exists.
	const canExtract = $derived(!!report && report.valid && !loading && !extracting);

	/**
	 * Opens a native file picker for a .stk file and inspects the chosen path.
	 * @returns {Promise<void>}
	 */
	async function pickAndInspect(): Promise<void> {
		try {
			const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
			const picked = await openDialog({ filters: [{ name: 'STK', extensions: ['stk'] }] });
			if (!picked) return;
			path = picked as string;
			await inspect();
		} catch {}
	}

	/**
	 * Runs a read-only inspection of the current .stk path via the backend.
	 * @returns {Promise<void>}
	 */
	async function inspect(): Promise<void> {
		if (!path) return;
		loading = true;
		error = null;
		report = null;
		try {
			const locale = getLocale();
			report = await api.inspectStk(path, locale);
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	/**
	 * Asks for an output directory and extracts the inspected .stk into a new
	 * editable kit. The source .stk is never mutated. Shows a success or error
	 * toast on completion.
	 * @returns {Promise<void>}
	 */
	async function extract(): Promise<void> {
		if (!canExtract || !path) return;
		try {
			const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
			const outDir = await openDialog({ directory: true });
			if (!outDir) return;
			extracting = true;
			error = null;
			const result = await api.extractStk(path, outDir as string, null, getLocale());
			notifySuccess(tr('inspect.extract_ok', { path: result.dest_dir }));
			onClose();
		} catch (e) {
			error = String(e);
			notifyError(tr('inspect.extract_error', { error: String(e) }));
		} finally {
			extracting = false;
		}
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
			aria-label={tr('inspect.title')}
			tabindex="-1"
			use:focusTrap
			use:dismissable={onClose}
		>
			<div class="header">
				<h2>{tr('inspect.title')}</h2>
				<button class="close" type="button" onclick={onClose} aria-label={tr('common.close')}>×</button>
			</div>

			<div class="actions">
				<button class="btn" type="button" onclick={pickAndInspect}>{tr('inspect.choose')}</button>
				<input
					class="path-input"
					type="text"
					bind:value={path}
					placeholder={tr('inspect.path_placeholder')}
					aria-label={tr('inspect.path_label')}
				/>
				<button class="btn primary" type="button" onclick={inspect} disabled={!path || loading}>
					{loading ? tr('inspect.inspecting') : tr('inspect.inspect')}
				</button>
				<button class="btn" type="button" onclick={extract} disabled={!canExtract}>
					{extracting ? tr('inspect.extracting') : tr('inspect.extract')}
				</button>
			</div>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			{#if report}
				<div class="summary" class:valid={report.valid} class:invalid={!report.valid}>
					<span class="badge {report.valid ? 'ok' : 'err'}">
						{report.valid ? tr('inspect.valid') : tr('inspect.invalid')}
					</span>
					<span>
						{tr('inspect.summary', {
							bytes: report.bytes,
							filled: report.pads_filled,
							total: report.pads_total,
							header: report.header_ok ? 'OK' : 'FAIL',
							ktdt: report.ktdt_ok ? 'OK' : 'FAIL'
						})}
					</span>
				</div>

				{#if report.errors.length}
					<h3>{tr('inspect.errors', { count: report.errors.length })}</h3>
					<ul class="list error">
						{#each report.errors as e}
							<li>✗ {e}</li>
						{/each}
					</ul>
				{/if}

				{#if report.warnings.length}
					<h3>{tr('inspect.warnings', { count: report.warnings.length })}</h3>
					<ul class="list warn">
						{#each report.warnings as w}
							<li>⚠ {w}</li>
						{/each}
					</ul>
				{/if}

				{#if report.info.length}
					<h3>{tr('inspect.info')}</h3>
					<ul class="list info">
						{#each report.info as i}
							<li>• {i}</li>
						{/each}
					</ul>
				{/if}

				<h3>{tr('inspect.pads')}</h3>
				<table class="pads">
					<thead>
						<tr>
							<th>{tr('inspect.col_pad')}</th>
							<th>{tr('inspect.col_path')}</th>
							<th>{tr('inspect.col_vol')}</th>
							<th>{tr('inspect.col_pan')}</th>
							<th>{tr('inspect.col_pitch')}</th>
							<th>{tr('inspect.col_fx')}</th>
							<th>{tr('inspect.col_valid')}</th>
						</tr>
					</thead>
					<tbody>
						{#each report.pads as pad}
							<tr class:invalid={!pad.valid}>
								<td>{pad.pad}</td>
								<td class="path" title={pad.path}>{pad.path || '—'}</td>
								<td>{pad.volume}</td>
								<td>{pad.pan}</td>
								<td>{pad.pitch}</td>
								<td>{pad.fx_send}</td>
								<td>{pad.valid ? '✓' : '✗'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<div class="footer">
				<button class="btn" type="button" onclick={onClose}>{tr('common.close')}</button>
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
		z-index: 240;
	}
	.modal {
		background: var(--bg-2, #23272b);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 12px;
		width: min(760px, 92vw);
		max-height: 88vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px 0;
	}
	h2 {
		margin: 0;
		font-size: 16px;
	}
	.close {
		background: none;
		border: none;
		color: var(--fg-dim);
		font-size: 22px;
		cursor: pointer;
	}
	.actions {
		display: flex;
		gap: 8px;
		padding: 12px 20px;
		align-items: center;
	}
	.path-input {
		flex: 1;
		padding: 6px 8px;
		background: var(--bg, #1a1d21);
		border: 1px solid var(--line);
		border-radius: 6px;
		color: var(--fg);
		font-size: 12px;
	}
	.summary {
		margin: 0 20px;
		padding: 8px 10px;
		border-radius: 6px;
		font-size: 12px;
		display: flex;
		gap: 10px;
		align-items: center;
		background: rgba(76, 175, 80, 0.1);
		border: 1px solid rgba(76, 175, 80, 0.3);
	}
	.summary.invalid {
		background: rgba(231, 76, 60, 0.1);
		border-color: rgba(231, 76, 60, 0.3);
	}
	.badge {
		padding: 2px 8px;
		border-radius: 10px;
		font-weight: 600;
		font-size: 11px;
	}
	.badge.ok {
		background: var(--ok, #4caf50);
		color: #fff;
	}
	.badge.err {
		background: var(--err, #e74c3c);
		color: #fff;
	}
	h3 {
		margin: 12px 20px 6px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
	}
	.list {
		list-style: none;
		padding: 0 20px;
		margin: 0;
		font-size: 12px;
	}
	.list.error li {
		color: #e74c3c;
	}
	.list.warn li {
		color: #f0ad4e;
	}
	.list.info li {
		color: var(--fg-dim);
	}
	.pads {
		width: calc(100% - 40px);
		margin: 0 20px;
		border-collapse: collapse;
		font-size: 11px;
	}
	.pads th,
	.pads td {
		padding: 4px 6px;
		border-bottom: 1px solid var(--line, #3a3f45);
		text-align: left;
	}
	.pads th {
		color: var(--fg-dim);
		font-weight: 600;
	}
	.pads .path {
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pads tr.invalid {
		background: rgba(231, 76, 60, 0.08);
	}
	.footer {
		display: flex;
		justify-content: flex-end;
		padding: 12px 20px;
		border-top: 1px solid var(--line);
	}
	.btn {
		padding: 6px 12px;
		border-radius: 6px;
		border: 1px solid var(--line);
		background: var(--bg-3, #2e3338);
		color: var(--fg);
		cursor: pointer;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn.primary {
		background: var(--accent, #d2a83f);
		color: #1a1d21;
		border-color: var(--accent);
		font-weight: 600;
	}
	.error {
		color: #e74c3c;
		padding: 0 20px;
		font-size: 12px;
	}
</style>
