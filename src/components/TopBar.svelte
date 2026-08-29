<svelte:options runes />

<script lang="ts">
	import {
		project,
		projectPath,
		status,
		saveKit,
		saveAs,
		openKit,
		guardUnsaved,
		compileKit,
		exportKit,
		undo,
		redo,
		undoStack,
		redoStack,
		closeKit,
		newKit,
		stkInspectOpen,
		findMissingGlobal,
		recentStore,
		openRecent
	} from '../stores/app';
	import { tr, locale, setLocale, available } from '../lib/i18n';
	import { onMount } from 'svelte';
	import brandLogo from '../assets/stk-editor-icon.svg?raw';
	import { open, save, ask } from '@tauri-apps/plugin-dialog';
	import { success, error } from '../stores/notify';
	import type { CompileReport } from '../lib/commands';
	import HelpMenu from './HelpMenu.svelte';

	let { onKitInformation = () => {}, onAbout = () => {}, onShortcuts = () => {} }: {
		onKitInformation?: () => void;
		onAbout?: () => void;
		onShortcuts?: () => void;
	} = $props();
	let openMenu = $state<'kit' | 'export' | null>(null);
	let recentOpen = $state(false);
	let topbar: HTMLElement;
	type Theme = 'dark' | 'light';
	type UiScale = 100 | 125 | 150 | 200;
	const UI_SCALES: readonly UiScale[] = [100, 125, 150, 200];
	let theme = $state<Theme>(initialTheme());
	let uiScale = $state<UiScale>(initialUiScale());

	function initialTheme(): Theme {
		try {
			return localStorage.getItem('stk-editor.theme') === 'light' ? 'light' : 'dark';
		} catch {
			return 'dark';
		}
	}

	function setTheme(next: Theme) {
		theme = next;
		document.documentElement.dataset.theme = next;
		try {
			localStorage.setItem('stk-editor.theme', next);
		} catch {}
	}

	function toggleTheme() {
		setTheme(theme === 'dark' ? 'light' : 'dark');
	}

	/** Reads the saved whole-interface scale, with 100% as the safe default. */
	function initialUiScale(): UiScale {
		try {
			const stored = Number(localStorage.getItem('stk-editor.ui-scale'));
			return UI_SCALES.includes(stored as UiScale) ? stored as UiScale : 100;
		} catch {
			return 100;
		}
	}

	/** Applies and persists a complete WebView scale, falling back to CSS zoom outside Tauri. */
	function setUiScale(next: UiScale) {
		uiScale = next;
		const factor = next / 100;
		document.documentElement.style.setProperty('--ui-scale', String(factor));
		document.documentElement.dataset.uiScale = String(next);
		delete document.documentElement.dataset.zoomMode;
		document.documentElement.style.zoom = '';
		try {
			localStorage.setItem('stk-editor.ui-scale', String(next));
		} catch {}
		void import('@tauri-apps/api/webview')
			.then(({ getCurrentWebview }) => getCurrentWebview().setZoom(factor))
			.catch(() => {
				document.documentElement.dataset.zoomMode = 'css';
				document.documentElement.style.zoom = String(factor);
			});
	}

	/** Closes an open menu when the user clicks anywhere outside the top bar. */
	function closeMenuOnClickAway(event: MouseEvent) {
		if (openMenu && !topbar.contains(event.target as Node)) closeMenu();
	}

	onMount(() => {
		setTheme(theme);
		setUiScale(uiScale);
		window.addEventListener('click', closeMenuOnClickAway);
		return () => window.removeEventListener('click', closeMenuOnClickAway);
	});

	function statusClass(kind: string) {
		if (kind.includes('error') || kind === 'invalid' || kind === 'missing') return 'error';
		return kind === 'saved' ? 'saved' : 'modified';
	}

	function statusLabel() {
		const key = `status.${$status.id}`;
		const translated = tr(key);
		return translated === key ? $status.label : translated;
	}

	const recentKits = $derived($recentStore.entries.slice(0, 5));

	/** Opens an editable JSON companion kit after the shared unsaved-work guard. */
	async function doOpen() {
		const out = await open({ filters: [{ name: 'SmplTrek Kit', extensions: ['json'] }] });
		if (!out) return;
		try {
			if (await guardUnsaved()) {
				await openKit(out as string);
				success(tr('menu.open'));
			}
		} catch (e) {
			error(String(e));
		}
	}

	/** Starts a fresh kit only after unsaved work has been protected. */
	async function doNew() {
		if (await guardUnsaved()) newKit();
	}

	/** Saves the current editable companion JSON. */
	async function doSave() {
		const savedPath = await saveKit();
		if (savedPath) success(tr('menu.save'));
	}

	/** Builds a device-compatible STK artifact at the user-selected location. */
	async function doCompile() {
		if (!$project.kit.name.trim()) {
			error(tr('status.invalid'));
			return;
		}
		try {
			const out = await save({
				defaultPath: `${$project.kit.name || 'kit'}.stk`,
				filters: [{ name: 'SmplTrek Kit', extensions: ['stk'] }],
			});
			if (!out) return;
			const { exists } = await import('@tauri-apps/plugin-fs');
			const existsFile = await exists(out as string);
			if (existsFile) {
				const { inspectStk } = await import('../lib/commands');
				const report = await inspectStk(out as string, $locale);
				const key = report.valid ? 'compile.overwrite' : 'compile.overwrite_invalid';
				if (!(await ask(tr(key, { path: out as string }), { title: tr('compile.title') }))) return;
			}
			const report: CompileReport | null = await compileKit(out as string, true, true);
			if (report) {
				status.update(() => ({ id: 'compile_ok', label: tr('status.compile_ok'), kind: 'compile_ok' }));
				success(`${report.pads_filled} pads · ${report.bytes} B`);
				if (report.warnings.length) error(report.warnings.join('; '));
			}
		} catch (e) {
			const message = `${tr('status.compile_error')}: ${String(e)}`;
			status.update(() => ({ id: 'compile_error', label: tr('status.compile_error'), kind: 'compile_error' }));
			error(message);
		}
	}

	/** Exports either device-only files or a full editable kit package. */
	async function doExport(profile: 'hardware' | 'full') {
		const out = await import('@tauri-apps/plugin-dialog').then((m) => m.open({ directory: true }));
		if (!out) return;
		try {
			const { inspectStk } = await import('../lib/commands');
			const { exists } = await import('@tauri-apps/plugin-fs');
			const stkPath = `${out as string}/${$project.kit.name}.stk`;
			if (await exists(stkPath)) {
				const report = await inspectStk(stkPath, $locale);
				if (!report.valid && !(await ask(tr('export.overwrite_invalid', { path: stkPath }), { title: tr('export.title') }))) return;
			}
			const report = await exportKit(out as string, profile, true);
			if (report) success(`export: ${report.paths.length} files — ${report.note}`);
		} catch (e) {
			error(String(e));
		}
	}

	/** Runs the existing missing-audio search without exposing another side-panel button. */
	async function doFindMissing() {
		await findMissingGlobal();
	}

	/** Returns the saved file stem so default project names never make recent entries indistinguishable. */
	function recentLabel(path: string) {
		const fileName = path.split(/[\\/]/).pop() ?? path;
		return fileName.replace(/\.[^.]+$/, '') || fileName;
	}

	/** Opens a recent kit through the same unsaved-work guard as the former recent menu. */
	async function doOpenRecent(path: string) {
		closeMenu();
		await openRecent(path);
	}

	function toggleMenu(menu: 'kit' | 'export') {
		if (openMenu === menu) {
			closeMenu();
			return;
		}
		openMenu = menu;
		recentOpen = false;
	}

	function closeMenu() {
		openMenu = null;
		recentOpen = false;
	}
</script>

<header class="topbar" bind:this={topbar}>
	<div class="brand" aria-label={tr('app.title')}>
		<span class="brand-logo" data-testid="brand-logo" aria-hidden="true">{@html brandLogo}</span>
		<span class="brand-name">{tr('app.title')}</span>
	</div>
	<div class="menu-wrap">
		<button class="btn menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === 'kit'} onclick={() => toggleMenu('kit')}>{tr('menu.kit')} <span class="menu-chevron" aria-hidden="true"></span></button>
		{#if openMenu === 'kit'}
			<div class="menu" role="menu" aria-label={tr('menu.kit')}>
				<button role="menuitem" type="button" onclick={() => { closeMenu(); void doNew(); }}>{tr('menu.new')}</button>
				<button role="menuitem" type="button" onclick={() => { closeMenu(); void doOpen(); }}>{tr('menu.open')}</button>
				<button role="menuitem" type="button" onclick={() => { closeMenu(); stkInspectOpen.set(true); }}>{tr('menu.open_compiled')}</button>
				<button role="menuitem" type="button" aria-haspopup="true" aria-expanded={recentOpen} onclick={() => (recentOpen = !recentOpen)}>
					{tr('menu.recent')} <span class="recent-chevron" aria-hidden="true">›</span>
				</button>
				{#if recentOpen}
					<div class="recent-kits" role="group" aria-label={tr('menu.recent')}>
						{#each recentKits as kit}
							<button data-testid="recent-kit" role="menuitem" type="button" title={kit.path} onclick={() => void doOpenRecent(kit.path)}>{recentLabel(kit.path)}</button>
						{:else}
							<span class="recent-empty">{tr('menu.no_recent')}</span>
						{/each}
					</div>
				{/if}
				<hr />
				<button role="menuitem" type="button" onclick={() => { closeMenu(); void doSave(); }}>{tr('menu.save')}</button>
				<button role="menuitem" type="button" onclick={() => { closeMenu(); void saveAs(); }}>{tr('menu.save_as')}</button>
				<hr />
				<button role="menuitem" type="button" onclick={() => { closeMenu(); onKitInformation(); }}>{tr('menu.kit_information')}</button>
				<button role="menuitem" type="button" onclick={() => { closeMenu(); void doFindMissing(); }}>{tr('menu.find_missing')}</button>
				<button role="menuitem" type="button" onclick={() => { closeMenu(); void closeKit(); }}>{tr('menu.close')}</button>
			</div>
		{/if}
	</div>
	<div class="menu-wrap">
		<button class="btn menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === 'export'} onclick={() => toggleMenu('export')}>{tr('menu.export')} <span class="menu-chevron" aria-hidden="true"></span></button>
		{#if openMenu === 'export'}
			<div class="menu" role="menu" aria-label={tr('menu.export')}>
				<button role="menuitem" type="button" onclick={() => { closeMenu(); void doCompile(); }}>{tr('menu.compile_file')}</button>
				<button role="menuitem" type="button" onclick={() => { closeMenu(); void doExport('hardware'); }}>{tr('menu.export_sd')}</button>
				<button role="menuitem" type="button" onclick={() => { closeMenu(); void doExport('full'); }}>{tr('menu.export_full')}</button>
			</div>
		{/if}
	</div>
	<div class="spacer"></div>
	<div class="project-name" title={$projectPath ?? ''}>{$project.kit.name || '—'}</div>
	<span class={`status-pill ${statusClass($status.kind)}`} title={statusLabel()}>{statusLabel()}</span>
	<button class="btn icon" type="button" onclick={() => void undo()} disabled={$undoStack.length === 0} aria-label={tr('menu.undo')} title={tr('menu.undo')}>↩</button>
	<button class="btn icon" type="button" onclick={() => void redo()} disabled={$redoStack.length === 0} aria-label={tr('menu.redo')} title={tr('menu.redo')}>↪</button>
	<select class="select" data-testid="ui-scale" aria-label={tr('display.scale')} value={uiScale} onchange={(event) => setUiScale(Number((event.target as HTMLSelectElement).value) as UiScale)}>
		{#each UI_SCALES as value}<option value={value}>{value} %</option>{/each}
	</select>
	<button class="btn icon theme-toggle" data-testid="theme-toggle" type="button" onclick={toggleTheme} aria-label={tr(theme === 'dark' ? 'theme.switch_to_light' : 'theme.switch_to_dark')} title={tr(theme === 'dark' ? 'theme.switch_to_light' : 'theme.switch_to_dark')}>
		<span aria-hidden="true">{theme === 'dark' ? '☀︎' : '☾'}</span>
	</button>
	<select class="select" aria-label={tr('menu.language')} value={$locale} onchange={(e) => setLocale((e.target as HTMLSelectElement).value as 'fr' | 'en')}>
		{#each available as l}<option value={l}>{l.toUpperCase()}</option>{/each}
	</select>
	<HelpMenu icon onShortcuts={onShortcuts} onAbout={onAbout} />
</header>

<style>
	.topbar { display:flex; align-items:center; gap:10px; padding:4px 12px; background:var(--bg-2,#23272b); border-bottom:1px solid var(--line,#3a3f45); min-height:72px; }
	.brand { display:flex; align-items:center; gap:10px; height:64px; white-space:nowrap; }
	.brand-logo { display:block; width:64px; height:64px; flex:0 0 64px; }
	.brand-logo :global(svg) { display:block; width:100%; height:100%; }
	.brand-name { color:var(--accent,#d2a83f); font-weight:700; letter-spacing:.01em; }
	.spacer { flex:1; }
	.project-name { max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--fg-dim,#9aa0a6); }
	.status-pill { padding:3px 10px; border-radius:12px; font-size:12px; font-weight:500; white-space:nowrap; }
	.status-pill.saved { background:rgba(76,175,80,.15); color:var(--ok,#4caf50); }
	.status-pill.modified { background:rgba(210,168,63,.15); color:var(--accent,#d2a83f); }
	.status-pill.error { background:rgba(231,76,60,.15); color:var(--err,#e74c3c); }
	.btn, .select { background:var(--bg-3,#2e3338); color:var(--fg,#e6e6e6); border:1px solid var(--line,#3a3f45); border-radius:4px; cursor:pointer; }
	.btn { padding:4px 10px; line-height:1.1; }
	.btn:hover, .btn[aria-expanded="true"] { background:var(--bg-4,#39414b); }
	.btn:disabled { opacity:.5; cursor:not-allowed; }
	.icon { min-width:31px; font-weight:700; }
	.menu-chevron { display:inline-block; width:0; height:0; margin-left:7px; border-left:4px solid transparent; border-right:4px solid transparent; border-top:6px solid currentColor; vertical-align:middle; transform:translateY(1px); }
	.select { padding:4px 8px; }
	.menu-wrap { position:relative; }
	.menu { position:absolute; top:calc(100% + 5px); left:0; z-index:250; min-width:220px; padding:4px; background:#3a4047; border:1px solid #59616a; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,.35); }
	.menu button { display:block; width:100%; padding:7px 9px; border:0; border-radius:4px; background:transparent; color:var(--fg,#e6e6e6); text-align:left; cursor:pointer; font:inherit; font-size:13px; }
	.menu button:hover, .menu button:focus-visible { background:var(--bg-3,#2e3338); outline:none; }
	.menu hr { height:1px; margin:4px 2px; border:0; background:var(--line,#3a3f45); }
	.recent-chevron { float:right; font-size:16px; line-height:12px; }
	.recent-kits { margin:2px 0 4px 8px; padding-left:4px; border-left:1px solid var(--line,#3a3f45); }
	.recent-kits button { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
	.recent-empty { display:block; padding:7px 9px; color:var(--fg-dim,#9aa0a6); font-size:13px; }
</style>
