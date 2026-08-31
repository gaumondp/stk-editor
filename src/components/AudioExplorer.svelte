<svelte:options runes />

<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type AudioFile } from '../lib/commands';
	import { tr, formatDuration, formatDate } from '../lib/i18n';
	import { notify } from '../stores/notify';
	import { previewingPath, previewVolume, previewWav, setPreviewVolume, stopPreview } from '../lib/audio-preview';

	type OptionalColumn = 'size' | 'duration' | 'date';

	const DEFAULT_PANEL_WIDTH = 320;
	const MIN_PANEL_WIDTH = 260;
	const MAX_PANEL_WIDTH = 640;
	const COLUMNS_STORAGE_KEY = 'stk-forge.audio-explorer.columns';
	const WIDTH_STORAGE_KEY = 'stk-forge.audio-explorer.visual-width.v2';

	let files = $state<AudioFile[]>([]);
	let dir = $state<string | null>(null);
	let query = $state('');
	let sortBy = $state<'name' | 'size' | 'duration' | 'date'>('name');
	let recentDirs = $state<string[]>([]);
	let recursive = $state(false);
	let panelWidth = $state(DEFAULT_PANEL_WIDTH);
	let visibleColumns = $state<Record<OptionalColumn, boolean>>({ size: true, duration: true, date: true });
	let activeMouseDragCleanup: (() => void) | null = null;
	let activeResizeCleanup: (() => void) | null = null;
	let suppressPreviewUntil = 0;
	let dragPreview = $state<{ name: string; x: number; y: number } | null>(null);

	const fileGridTemplate = $derived([
		'minmax(0, 1fr)',
		visibleColumns.size ? 'minmax(54px, auto)' : '',
		visibleColumns.duration ? 'minmax(54px, auto)' : '',
		visibleColumns.date ? 'minmax(76px, auto)' : '',
		'10px',
	].filter(Boolean).join(' '));

	const filtered = $derived(
		files
			.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
			.sort((a, b) => {
				if (sortBy === 'size') return b.size - a.size;
				if (sortBy === 'duration') return b.durationMs - a.durationMs;
				if (sortBy === 'date') return (b.modified ?? 0) - (a.modified ?? 0);
				return a.name.localeCompare(b.name);
			}),
	);

	onMount(() => {
		try {
			const stored = JSON.parse(localStorage.getItem('recentAudioDirs') ?? '[]');
			if (Array.isArray(stored)) recentDirs = stored.slice(0, 5);
			const last = localStorage.getItem('lastAudioDir');
			if (last) dir = last;
			const savedColumns = JSON.parse(localStorage.getItem(COLUMNS_STORAGE_KEY) ?? '{}');
			if (savedColumns && typeof savedColumns === 'object') {
				for (const column of ['size', 'duration', 'date'] as const) {
					if (typeof savedColumns[column] === 'boolean') visibleColumns[column] = savedColumns[column];
				}
			}
			const savedWidth = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
			if (Number.isFinite(savedWidth)) panelWidth = clampPanelWidth(savedWidth / uiScaleFactor());
			else panelWidth = clampPanelWidth(panelWidth);
			if (dir) void load();
		} catch {}

		return () => activeResizeCleanup?.();
	});

	/** Limits the stored panel width to the usable range. */
	function clampPanelWidth(width: number): number {
		const scale = uiScaleFactor();
		return Math.min(MAX_PANEL_WIDTH / scale, Math.max(MIN_PANEL_WIDTH / scale, Math.round(width)));
	}

	/** Returns the saved complete-interface scale used to keep Explorer width visually stable. */
	function uiScaleFactor(): number {
		try {
			const scale = Number(localStorage.getItem('stk-forge.ui-scale'));
			return [100, 125, 150, 200].includes(scale) ? scale / 100 : 1;
		} catch {
			return 1;
		}
	}

	/** Writes the current Explorer width in 100%-scale pixels after a completed adjustment. */
	function persistPanelWidth(): void {
		try { localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(panelWidth * uiScaleFactor()))); } catch {}
	}

	/** Updates one optional column preference while keeping the Name column permanently visible. */
	function setColumnVisible(column: OptionalColumn, visible: boolean): void {
		visibleColumns[column] = visible;
		try { localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns)); } catch {}
	}

	/** Begins an Explorer width drag from the panel's left resize handle. */
	function handleResizePointerDown(event: PointerEvent): void {
		event.preventDefault();
		activeResizeCleanup?.();
		const startX = event.clientX;
		const startWidth = panelWidth;
		const onPointerMove = (moveEvent: PointerEvent) => {
			panelWidth = clampPanelWidth(startWidth + startX - moveEvent.clientX);
		};
		const cleanup = () => {
			persistPanelWidth();
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', cleanup);
			window.removeEventListener('blur', cleanup);
			activeResizeCleanup = null;
		};
		activeResizeCleanup = cleanup;
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', cleanup, { once: true });
		window.addEventListener('blur', cleanup, { once: true });
	}

	/** Adjusts the Explorer width by keyboard and persists the completed change. */
	function handleResizeKeyDown(event: KeyboardEvent): void {
		const delta = event.key === 'ArrowLeft' ? 16 : event.key === 'ArrowRight' ? -16 : 0;
		if (!delta) return;
		event.preventDefault();
		panelWidth = clampPanelWidth(panelWidth + delta);
		persistPanelWidth();
	}

	async function chooseDir() {
		const out = await import('@tauri-apps/plugin-dialog').then((m) => m.open({ directory: true }));
		if (!out) return;
		dir = out as string;
		try {
			localStorage.setItem('lastAudioDir', dir);
			const updated = [dir, ...recentDirs.filter((d) => d !== dir)].slice(0, 5);
			recentDirs = updated;
			localStorage.setItem('recentAudioDirs', JSON.stringify(updated));
		} catch {}
		await load();
	}

	function selectRecent(newDir: string) {
		dir = newDir;
		try { localStorage.setItem('lastAudioDir', dir); } catch {}
		void load();
	}

	async function load() {
		if (!dir) return;
		try {
			files = await api.listWavs(dir);
		} catch (e) {
			notify('error', String(e));
		}
	}

	/** Starts a desktop mouse drag and listens globally until the mouse is released or leaves the window. */
	function handleMouseDown(event: MouseEvent, file: AudioFile) {
		if (event.button !== 0) return;
		event.preventDefault();
		activeMouseDragCleanup?.();
		const startX = event.clientX;
		const startY = event.clientY;
		let active = false;
		const cleanup = () => {
			dragPreview = null;
			window.removeEventListener('mousemove', onMouseMove, true);
			window.removeEventListener('mouseup', onMouseUp, true);
			window.removeEventListener('blur', onWindowBlur);
			activeMouseDragCleanup = null;
		};
		const onMouseMove = (moveEvent: MouseEvent) => {
			if (!active && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
			active = true;
			dragPreview = { name: file.name, x: moveEvent.clientX, y: moveEvent.clientY };
			moveEvent.preventDefault();
			window.dispatchEvent(new CustomEvent('smpltrek-audio-drag-move', {
				detail: { path: file.path, clientX: moveEvent.clientX, clientY: moveEvent.clientY }
			}));
		};
		const onMouseUp = (upEvent: MouseEvent) => {
			cleanup();
			if (!active) return;
			upEvent.preventDefault();
			suppressPreviewUntil = performance.now() + 250;
			window.dispatchEvent(new CustomEvent('smpltrek-audio-drag-end', {
				detail: { path: file.path, clientX: upEvent.clientX, clientY: upEvent.clientY }
			}));
		};
		const onWindowBlur = () => {
			cleanup();
			if (active) window.dispatchEvent(new CustomEvent('smpltrek-audio-drag-cancel'));
		};
		activeMouseDragCleanup = cleanup;
		window.addEventListener('mousemove', onMouseMove, true);
		window.addEventListener('mouseup', onMouseUp, true);
		window.addEventListener('blur', onWindowBlur);
	}

	/** Preserves click-to-preview while ignoring the synthetic click after a drag. */
	function handleFileClick(file: AudioFile) {
		if (performance.now() < suppressPreviewUntil) return;
		preview(file);
	}

	/** Toggles shared WAV preview while preserving the click-to-preview interaction. */
	function preview(file: AudioFile) {
		void previewWav(file.path);
	}

	/** Returns the currently previewed WAV filename for the compact player row. */
	function previewFileName(path: string | null): string {
		return path?.split(/[\\/]/).pop() ?? tr('explorer.no_preview');
	}

	/** Formats valid WAV durations and leaves invalid metadata blank. */
	function fmtDuration(ms: number) {
		return Number.isFinite(ms) ? formatDuration(ms) : '';
	}

	/** Formats valid WAV byte sizes using compact binary units. */
	function fmtSize(bytes: number) {
		if (!Number.isFinite(bytes) || bytes < 0) return '';
		if (bytes < 1024) return `${bytes} B`;
		const kilobytes = bytes / 1024;
		return `${kilobytes % 1 === 0 ? kilobytes : kilobytes.toFixed(1)} KB`;
	}

	/** Formats valid WAV modification times and leaves missing metadata blank. */
	function fmtDate(ts?: number) {
		return ts && Number.isFinite(ts) ? formatDate(ts) : '';
	}
</script>

<aside class="panel audio-explorer" style={`--explorer-width: ${panelWidth}px;`}>
	<button
		class="resize-handle"
		type="button"
		aria-label={tr('explorer.resize')}
		onpointerdown={handleResizePointerDown}
		onkeydown={handleResizeKeyDown}></button>
	<h3>{tr('explorer.title')}</h3>
	<div class="body">
		<div class="toolbar">
			<button class="btn" type="button" onclick={chooseDir}>{tr('explorer.select_dir')}</button>
			<button class="btn" type="button" onclick={load} disabled={!dir} title="Refresh">↻</button>
		</div>
		<div class="preview-controls">
			<button class="btn preview-stop" type="button" onclick={stopPreview} disabled={!$previewingPath} aria-label={tr('explorer.stop')}>■</button>
			<span class="preview-name" title={$previewingPath ?? ''}>{previewFileName($previewingPath)}</span>
			<label class="preview-volume">
				<span>{tr('explorer.volume')}</span>
				<input aria-label={tr('explorer.preview_volume')} type="range" min="0" max="100" value={Math.round($previewVolume * 100)} oninput={(event) => setPreviewVolume(Number((event.target as HTMLInputElement).value) / 100)} />
			</label>
		</div>
		{#if recentDirs.length}
			<select class="recent-select" onchange={(e) => selectRecent((e.target as HTMLSelectElement).value)} value={dir ?? ''}>
				<option value="" disabled>Recent folders…</option>
				{#each recentDirs as r}
					<option value={r}>{r}</option>
				{/each}
			</select>
		{/if}
		{#if dir}
			<div class="dir" title={dir}>{dir} • {files.length} files</div>
		{/if}

		<input type="search" placeholder={tr('explorer.search')} bind:value={query} />

		<div class="controls-row">
			<label class="sort">
				{tr('explorer.sort')}
				<select bind:value={sortBy}>
					<option value="name">{tr('explorer.sort_name') ?? 'Name'}</option>
					<option value="size">{tr('explorer.size')}</option>
					<option value="duration">{tr('explorer.duration')}</option>
					<option value="date">{tr('explorer.date')}</option>
				</select>
			</label>
			<label class="check">
				<input type="checkbox" bind:checked={recursive} disabled title="Recursive scan — backend flat only (V1.1)" />
				Recursive
			</label>
		</div>
		<fieldset class="column-controls">
			<legend>{tr('explorer.columns')}</legend>
			<label><input type="checkbox" checked={visibleColumns.size} onchange={(event) => setColumnVisible('size', (event.target as HTMLInputElement).checked)} /> {tr('explorer.show_size')}</label>
			<label><input type="checkbox" checked={visibleColumns.duration} onchange={(event) => setColumnVisible('duration', (event.target as HTMLInputElement).checked)} /> {tr('explorer.show_duration')}</label>
			<label><input type="checkbox" checked={visibleColumns.date} onchange={(event) => setColumnVisible('date', (event.target as HTMLInputElement).checked)} /> {tr('explorer.show_date')}</label>
		</fieldset>

		<div class="file-list" role="table">
			<div class="file-header" role="row" style={`grid-template-columns: ${fileGridTemplate};`}>
				<span role="columnheader">{tr('explorer.name')}</span>
				{#if visibleColumns.size}<span role="columnheader">{tr('explorer.size')}</span>{/if}
				{#if visibleColumns.duration}<span role="columnheader">{tr('explorer.duration')}</span>{/if}
				{#if visibleColumns.date}<span role="columnheader">{tr('explorer.date')}</span>{/if}
				<span aria-hidden="true"></span>
			</div>
			{#each filtered as f (f.path)}
				<div
					class="file-row {f.compatible ? '' : 'missing'} {$previewingPath === f.path ? 'playing' : ''}"
					role="row"
					style={`grid-template-columns: ${fileGridTemplate};`}
					onmousedown={(event) => handleMouseDown(event, f)}
					ondblclick={() => preview(f)}
					onclick={() => handleFileClick(f)}
					title={`${f.path}\n${f.compatible ? 'compatible' : f.warning ?? ''}\n${f.modified ? fmtDate(f.modified) : ''}`}
					tabindex="0"
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') preview(f); }}>
					<span class="name" role="cell">{f.name}</span>
					{#if visibleColumns.size}<span class="meta" role="cell">{fmtSize(f.size)}</span>{/if}
					{#if visibleColumns.duration}<span class="meta" role="cell">{fmtDuration(f.durationMs)}</span>{/if}
					{#if visibleColumns.date}<span class="meta" role="cell">{fmtDate(f.modified)}</span>{/if}
					<span class="dot {f.compatible ? 'ok' : 'warn'}" title={f.warning ?? ''} aria-label={tr('explorer.play')}></span>
				</div>
			{/each}
			{#if !files.length}
				<div class="empty">… {dir ? 'no WAV found' : 'select a folder'}</div>
			{/if}
		</div>
	</div>
</aside>

{#if dragPreview}
	<div class="drag-preview" style={`left: ${dragPreview.x}px; top: ${dragPreview.y}px;`}>
		<span class="drag-preview-label">WAV</span>
		<span>{dragPreview.name}</span>
	</div>
{/if}

<style>
	.drag-preview {
		position: fixed;
		z-index: 9999;
		transform: translate(14px, 14px);
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 9px;
		background: rgba(22, 29, 36, 0.94);
		border: 1px solid var(--accent-2, #4a90d2);
		border-radius: 5px;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
		color: var(--fg, #e6e6e6);
		font-size: 12px;
		pointer-events: none;
		user-select: none;
		-webkit-user-select: none;
	}
	.drag-preview-label {
		padding: 1px 4px;
		border-radius: 3px;
		background: var(--accent-2, #4a90d2);
		color: #fff;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.05em;
	}

	.panel {
		position: relative;
		flex: 0 0 var(--explorer-width);
		background: var(--bg-2, #23272b);
		border-left: 1px solid var(--line, #3a3f45);
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
	}
	.resize-handle {
		position: absolute;
		z-index: 1;
		inset: 0 auto 0 -5px;
		width: 9px;
		cursor: col-resize;
		border: 0;
		padding: 0;
		background: transparent;
		outline: none;
	}
	.resize-handle:hover,
	.resize-handle:focus-visible { background: var(--accent-2, #4a90d2); opacity: 0.7; }

	h3 {
		margin: 0;
		padding: 8px 12px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--fg-dim, #9aa0a6);
		border-bottom: 1px solid var(--line, #3a3f45);
	}

	.body {
		padding: 10px 12px;
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.toolbar { display: flex; gap: 6px; }
	.preview-controls {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		padding: 6px 8px;
		border: 1px solid var(--line, #3a3f45);
		border-radius: 5px;
		background: var(--bg, #1a1d21);
	}
	.preview-stop { min-width: 28px; padding-inline: 6px; }
	.preview-name { overflow: hidden; color: var(--fg-dim, #9aa0a6); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
	.preview-volume { display: flex; align-items: center; gap: 5px; color: var(--fg-dim, #9aa0a6); font-size: 10px; }
	.preview-volume input { width: 88px; accent-color: var(--accent-2, #4a90d2); }
	.dir { font-size: 11px; color: var(--fg-dim, #9aa0a6); margin: 6px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.recent-select { width: 100%; margin: 6px 0; padding: 4px 6px; background: var(--bg, #1a1d21); color: var(--fg, #e6e6e6); border: 1px solid var(--line, #3a3f45); border-radius: 4px; font-size: 11px; }
	.controls-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 8px 0 4px; }
	.sort { display: flex; align-items: center; gap: 6px; font-size: 11px; flex: 1; }
	.check { display: flex; align-items: center; gap: 4px; font-size: 11px; opacity: 0.7; }
	.column-controls { display: flex; flex-wrap: wrap; gap: 4px 8px; margin: 0 0 6px; padding: 4px 0; border: 0; color: var(--fg-dim, #9aa0a6); font-size: 10px; }
	.column-controls legend { padding: 0; color: var(--fg-dim, #9aa0a6); }
	.column-controls label { display: flex; align-items: center; gap: 3px; }

	.file-list { margin: 6px 0 0; flex: 1; min-height: 0; overflow-x: auto; overflow-y: auto; }
	.file-header,
	.file-row { display: grid; align-items: center; column-gap: 6px; min-width: max-content; }
	.file-header { position: sticky; top: 0; z-index: 1; padding: 3px 6px; background: var(--bg-2, #23272b); border-bottom: 1px solid var(--line, #3a3f45); color: var(--fg-dim, #9aa0a6); font-size: 10px; text-transform: uppercase; }
	.file-row { padding: 4px 6px; border-radius: 4px; cursor: grab; background: none; border: none; text-align: left; user-select: none; -webkit-user-select: none; outline: none; }
	.file-row:hover,
	.file-row:focus-visible { background: var(--bg-3, #2e3338); }
	.file-row.playing { background: rgba(74,144,210,0.15); outline: 1px solid var(--accent-2, #4a90d2); }
	.file-row.missing { background: rgba(231, 76, 60, 0.08); }
	.file-row.missing .name { text-decoration: line-through; text-decoration-thickness: 2px; }
	.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.meta { color: var(--fg-dim, #9aa0a6); font-size: 10px; white-space: nowrap; }
	.dot { width: 10px; height: 10px; border-radius: 50%; border: none; flex-shrink: 0; }
	.dot.ok { background: var(--ok, #4caf50); }
	.dot.warn { background: var(--warn, #f0ad4e); }
	.empty { padding: 8px 6px; color: var(--fg-dim, #9aa0a6); }
	input[type='search'] { width: 100%; padding: 5px 8px; background: var(--bg, #1a1d21); color: var(--fg, #e6e6e6); border: 1px solid var(--line, #3a3f45); border-radius: 4px; }
	.btn { background: var(--bg-3, #2e3338); color: var(--fg, #e6e6e6); border: 1px solid var(--line, #3a3f45); border-radius: 4px; padding: 4px 8px; cursor: pointer; }
	.btn:disabled { opacity: 0.5; cursor: default; }
</style>
