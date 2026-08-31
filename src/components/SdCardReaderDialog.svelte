<svelte:options runes />

<script lang="ts">
	import { focusTrap } from '../lib/focusTrap';
	import { dismissable } from '../lib/dismissable';
	import { getLocale, tr, formatFileSize, formatNumber } from '../lib/i18n';
	import type { SdCardReport } from '../lib/commands';

	let {
		open = false,
		report = null,
		onClose = () => {},
		onChooseAnother = () => {}
	}: {
		open: boolean;
		report: SdCardReport | null;
		onClose: () => void;
		onChooseAnother: () => void;
	} = $props();

	// Filter text for the audio-file list. Reset whenever the dialog opens or
	// the underlying report identity changes, so a stale filter never hides a
	// freshly selected card's files.
	let filter = $state('');
	$effect(() => {
		// Touch open + report so the reset re-runs on each open / new report.
		void open;
		void report;
		filter = '';
	});

	// A localized colon: French uses a narrow-no-break space before the colon.
	const colon = $derived(getLocale() === 'fr' ? '\u00A0:' : ':');

	// Report classification. The backend never auto-detects media; these states
	// describe only what was found at the selected location.
	//   invalid    → no SmplTrek folder at all (smpltrek_path == null)
	//   incomplete → folder exists but required directories are missing
	//   valid      → folder exists and passed validation
	const isInvalid = $derived(!!report && (report.smpltrek_path === null || report.smpltrek_path === undefined));
	const isIncomplete = $derived(!!report && !isInvalid && !report.valid);
	const isValid = $derived(!!report && !isInvalid && report.valid);

	const statusKey = $derived(isValid ? 'sd_reader.valid' : isIncomplete ? 'sd_reader.incomplete' : 'sd_reader.invalid');
	const statusClass = $derived(isValid ? 'ok' : isIncomplete ? 'warn' : 'err');

	// Case-insensitive filter over the relative paths of every audio file.
	const filteredAudio = $derived.by(() => {
		if (!report) return [];
		const needle = filter.trim().toLowerCase();
		if (!needle) return report.audio_files;
		return report.audio_files.filter((f) => f.relative_path.toLowerCase().includes(needle));
	});

	/**
	 * Closes the dialog when the click originated on the backdrop itself
	 * rather than on the modal content.
	 * @param {MouseEvent} e - The originating click event.
	 * @returns {void}
	 */
	function handleBackdrop(e: MouseEvent): void {
		if ((e.target as HTMLElement).classList.contains('backdrop')) onClose();
	}
</script>

{#if open && report}
	<div class="backdrop" role="presentation" onclick={handleBackdrop}>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label={tr('sd_reader.title')}
			tabindex="-1"
			use:focusTrap
			use:dismissable={onClose}
		>
			<div class="header">
				<h2>{tr('sd_reader.title')}</h2>
				<button class="close" type="button" onclick={onClose} aria-label={tr('sd_reader.close')}>×</button>
			</div>

			<div class="body">
				<div class="status {statusClass}">
					<span class="badge {statusClass}">{tr(statusKey)}</span>
				</div>

				<h3>{tr('sd_reader.selected_path')}</h3>
				<p class="path" title={report.selected_path}>{report.selected_path}</p>

				{#if isIncomplete && report.missing_directories.length}
					<h3>{tr('sd_reader.missing_directories')}</h3>
					<ul class="list warn">
						{#each report.missing_directories as dir}
							<li>{dir}</li>
						{/each}
					</ul>
				{/if}

				<h3>{tr('sd_reader.projects')}</h3>
				{#if report.projects.length}
					<ul class="list">
						{#each report.projects as project}
							<li>{project}</li>
						{/each}
					</ul>
				{:else}
					<p class="empty">{tr('sd_reader.no_projects')}</p>
				{/if}

				<h3>{tr('sd_reader.presets')}</h3>
				<ul class="list presets">
					<li>
						<span>{tr('sd_reader.preset_audio_drum')}</span><span class="num"
							>{formatNumber(report.presets.audio_drum)}</span
						>
					</li>
					<li>
						<span>{tr('sd_reader.preset_audio_inst')}</span><span class="num"
							>{formatNumber(report.presets.audio_inst)}</span
						>
					</li>
					<li><span>{tr('sd_reader.preset_kit')}</span><span class="num">{formatNumber(report.presets.kit)}</span></li>
				</ul>

				<h3>
					{tr('sd_reader.audio_files')}{colon}
					<span class="count">{tr('sd_reader.files_count', { count: formatNumber(report.audio_files.length) })}</span>
				</h3>
				<input
					class="search"
					type="text"
					bind:value={filter}
					placeholder={tr('sd_reader.search_audio')}
					aria-label={tr('sd_reader.search_audio')}
				/>
				{#if report.audio_files.length === 0}
					<p class="empty">{tr('sd_reader.no_audio_files')}</p>
				{:else}
					<table class="audio">
						<thead>
							<tr>
								<th>{tr('explorer.name')}</th>
								<th class="right">{tr('explorer.size')}</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredAudio as file}
								<tr>
									<td class="rel" title={file.relative_path}>{file.relative_path}</td>
									<td class="right num">{formatFileSize(file.bytes)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>

			<div class="footer">
				<button class="btn" type="button" onclick={onChooseAnother}>{tr('sd_reader.choose_another')}</button>
				<button class="btn primary" type="button" onclick={onClose}>{tr('sd_reader.close')}</button>
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
	.body {
		padding: 8px 0 4px;
		overflow-y: auto;
	}
	.status {
		margin: 8px 20px;
	}
	.badge {
		padding: 3px 10px;
		border-radius: 10px;
		font-weight: 600;
		font-size: 11px;
		color: #fff;
	}
	.badge.ok {
		background: var(--ok, #4caf50);
	}
	.badge.warn {
		background: var(--warn, #f0ad4e);
		color: var(--bg, #1a1d21);
	}
	.badge.err {
		background: var(--err, #e74c3c);
	}
	h3 {
		margin: 12px 20px 6px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
	}
	h3 .count {
		text-transform: none;
		letter-spacing: 0;
		color: var(--fg-dim);
		font-weight: 400;
	}
	.path {
		margin: 0 20px;
		font-size: 12px;
		word-break: break-all;
		color: var(--fg);
	}
	.empty {
		margin: 0 20px;
		font-size: 12px;
		color: var(--fg-dim);
	}
	.list {
		list-style: none;
		padding: 0 20px;
		margin: 0;
		font-size: 12px;
		color: var(--fg);
	}
	.list.warn li {
		color: var(--warn, #f0ad4e);
	}
	.list.presets li {
		display: flex;
		justify-content: space-between;
		max-width: 240px;
		padding: 2px 0;
	}
	.num {
		font-variant-numeric: tabular-nums;
		color: var(--fg-dim);
	}
	.search {
		margin: 0 20px;
		width: calc(100% - 40px);
		box-sizing: border-box;
		padding: 6px 8px;
		background: var(--bg, #1a1d21);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 6px;
		color: var(--fg);
		font-size: 12px;
	}
	.audio {
		width: calc(100% - 40px);
		margin: 8px 20px 0;
		border-collapse: collapse;
		font-size: 11px;
	}
	.audio th,
	.audio td {
		padding: 4px 6px;
		border-bottom: 1px solid var(--line, #3a3f45);
		text-align: left;
	}
	.audio th {
		color: var(--fg-dim);
		font-weight: 600;
	}
	.audio .right {
		text-align: right;
	}
	.audio .rel {
		max-width: 480px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.footer {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 20px;
		border-top: 1px solid var(--line, #3a3f45);
	}
	.btn {
		padding: 6px 12px;
		border-radius: 6px;
		border: 1px solid var(--line, #3a3f45);
		background: var(--bg-3, #2e3338);
		color: var(--fg);
		cursor: pointer;
	}
	.btn.primary {
		background: var(--accent, #d2a83f);
		color: var(--bg, #1a1d21);
		border-color: var(--accent, #d2a83f);
		font-weight: 600;
	}
</style>
