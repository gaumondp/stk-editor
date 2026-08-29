<svelte:options runes />

<script lang="ts">
	import { setKitName, setNotes, findMissingGlobal, compileKit, exportKit, setPrefs, relink, missingDialogOpen } from '../stores/app';
	import { tr, getLocale } from '../lib/i18n';
	import { project, validation } from '../stores/app';
	import { success, error as notifyError } from '../stores/notify';
	import { inspectStk } from '../lib/commands';
	import HelpTooltip from './HelpTooltip.svelte';

	let missingPads = $derived(
		Object.entries($project.kit.pads)
			.filter(([, s]) => s && s.original_path && s.original_path !== s.resolved_path && !s.resolved_path)
			.map(([pad, s]) => ({ pad: Number(pad), sample: s }))
	);

	async function onRelink(pad: number) {
		const { open } = await import('@tauri-apps/plugin-dialog');
		const picked = await open({ filters: [{ name: 'WAV', extensions: ['wav'] }] });
		if (!picked) return;
		await relink(pad, picked as string, true);
	}

	// reactive views
	let kitNameDraft = $state('');
	$effect(() => {
		kitNameDraft = $project?.kit?.name ?? '';
	});

	function toggleCopySamples() {
		const prefs = { ...$project.prefs, copy_samples: !$project.prefs?.copy_samples };
		setPrefs(prefs);
	}

	async function onFindMissing() {
		missingDialogOpen.set(true);
		await findMissingGlobal();
	}

	async function onCompile() {
	try {
		const { save } = await import('@tauri-apps/plugin-dialog');
		const out = await save({
			defaultPath: `${$project.kit.name || 'kit'}.stk`,
			filters: [{ name: 'SmplTrek Kit', extensions: ['stk'] }],
		});
		if (!out) return;
		const { exists } = await import('@tauri-apps/plugin-fs');
		if (await exists(out as string)) {
			const report = await inspectStk(out as string, getLocale());
			if (!report.valid) {
				const ok = await import('@tauri-apps/plugin-dialog').then((m) => m.ask(tr('compile.overwrite_invalid', { path: out as string }), { title: tr('compile.title') }));
				if (!ok) return;
			} else {
				const ok = await import('@tauri-apps/plugin-dialog').then((m) => m.ask(tr('compile.overwrite'), { title: tr('compile.title') }));
				if (!ok) return;
			}
		}
		const report = await compileKit(out as string, true, true);
		if (report) {
			success(`Compiled ${report.pads_filled} pads → ${report.bytes} B`);
			if (report.warnings.length) notifyError(report.warnings.join('; '));
		}
	} catch (e) {
		notifyError(String(e));
	}
}

async function onExport(profile: 'hardware' | 'full') {
	try {
		const { open } = await import('@tauri-apps/plugin-dialog');
		const out = await open({ directory: true });
		if (!out) return;
		const { exists } = await import('@tauri-apps/plugin-fs');
		const stkPath = `${out as string}/${$project.kit.name}.stk`;
		if (await exists(stkPath)) {
			const report = await inspectStk(stkPath, getLocale());
			if (!report.valid) {
				const ok = await import('@tauri-apps/plugin-dialog').then((m) => m.ask(tr('export.overwrite_invalid', { path: stkPath }), { title: tr('export.title') }));
				if (!ok) return;
			}
		}
		const report = await exportKit(out as string, profile, true);
		if (report) {
			success(`Export: ${report.paths.length} files — ${report.note}`);
			const stkPath = report.paths.find((p) => p.endsWith('.stk'));
			if (stkPath) {
				try {
					const { exists } = await import('@tauri-apps/plugin-fs');
					if (await exists(stkPath)) success('Verify: .stk written — safely eject SD before removing');
					else notifyError('Export verification failed: .stk not found');
				} catch {}
			}
		}
	} catch (e) {
		notifyError(String(e));
	}
}
</script>

<aside class="panel">
	<h3>{tr('kit.name')}</h3>
	<div class="body kit-body">
		<input
			class="kit-name"
			type="text"
			bind:value={kitNameDraft}
			onblur={() => $project.kit.name !== kitNameDraft && setKitName(kitNameDraft)}
			onkeydown={(e) => e.key === 'Enter' && setKitName(kitNameDraft)}
			title={tr('kit.name')} />

		<label>{tr('kit.notes')}</label>
		<textarea
			rows="3"
			bind:value={$project.kit.notes}
			oninput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
			placeholder={tr('kit.notes')}>
		</textarea>

		<label>
			{tr('compile.copy_samples')}
			<input type="checkbox" checked={$project.prefs?.copy_samples ?? false} onclick={toggleCopySamples} />
		</label>

		<h3>{tr('compile.title')} <HelpTooltip text="Validates kit name, pad params, and file existence, then builds 48k/16-bit STK. Empty pads become silence." /></h3>
		{#if $validation.errors.length}
			<ul class="error-list">
				{#each $validation.errors as e}
					<li class="error">✗ {e}</li>
				{/each}
			</ul>
		{/if}
		{#if $validation.warnings.length}
			<ul class="warn-list">
				{#each $validation.warnings as w}
					<li class="warn">⚠ {w}</li>
				{/each}
			</ul>
		{/if}

		{#if missingPads.length}
			<h3>{tr('missing.title') ?? 'Missing files'} ({missingPads.length})</h3>
			<ul class="missing-list">
				{#each missingPads as { pad, sample }}
					<li class="missing-item">
						<span class="pad-num">Pad {pad}</span>
						<span class="file" title={sample.original_path}>{sample.file_name}</span>
						<button class="btn small" type="button" onclick={() => onRelink(pad)}>{tr('missing.relink') ?? 'Relink'}</button>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="actions">
			<button class="btn btn--primary" type="button" onclick={onCompile}>{tr('btn.compile')}</button>
			<button class="btn" type="button" onclick={onFindMissing}>{tr('explorer.missing_global')}</button>
			<button class="btn" type="button" onclick={() => onExport('hardware')}>{tr('btn.export_sd')}</button>
			<button class="btn" type="button" onclick={() => onExport('full')}>{tr('btn.export_full')}</button>
		</div>
	</div>
</aside>

<style>
	.panel {
		background: var(--bg-2, #23272b);
		border-left: 1px solid var(--line, #3a3f45);
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 280px;
	}
	h3 {
		margin: 0;
		padding: 8px 12px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--fg-dim, #9aa0a6);
		border-bottom: 1px solid var(--line, #3a3f45);
	}
	label {
		font-size: 11px;
		color: var(--fg-dim, #9aa0a6);
		display: block;
		margin: 8px 0 4px;
	}
	.body {
		padding: 10px 12px;
		overflow: auto;
		flex: 1;
	}
	.kit-name {
		width: 100%;
		padding: 5px 8px;
		background: var(--bg, #1a1d21);
		color: var(--fg, #e6e6e6);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 4px;
	}
	textarea {
		width: 100%;
		padding: 5px 8px;
		background: var(--bg, #1a1d21);
		color: var(--fg, #e6e6e6);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 4px;
		font-family: inherit;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 12px;
	}
	.error-list,
	.warn-list {
		list-style: none;
		padding: 0;
		margin: 8px 0;
	}
	.error-list li {
		color: #e74c3c;
		font-size: 12px;
		padding: 2px 0;
	}
	.warn-list li {
		color: #f0ad4e;
		font-size: 12px;
		padding: 2px 0;
	}
	.btn {
		background: var(--bg-3, #2e3338);
		color: var(--fg, #e6e6e6);
		border: 1px solid var(--line, #3a3f45);
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
	}
	.btn--primary {
		background: var(--accent, #d2a83f);
		color: #1a1d21;
		border-color: var(--accent, #d2a83f);
		font-weight: 600;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.missing-list { list-style: none; padding: 0; margin: 8px 0; }
	.missing-item { display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 11px; border-bottom: 1px solid var(--line, #222); }
	.missing-item .pad-num { color: var(--accent, #d2a83f); font-weight: 600; min-width: 44px; }
	.missing-item .file { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e74c3c; }
	.btn.small { padding: 2px 8px; font-size: 11px; }
</style>