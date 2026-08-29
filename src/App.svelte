<svelte:options runes />

<script lang="ts">
	import { onMount } from 'svelte';
import { get } from 'svelte/store';
	import TopBar from './components/TopBar.svelte';
	import DeviceView from './components/DeviceView.svelte';
	import AudioExplorer from './components/AudioExplorer.svelte';
	import KitInformationDialog from './components/KitInformationDialog.svelte';
	import ShortcutsDialog from './components/ShortcutsDialog.svelte';
	import UnsavedDialog from './components/UnsavedDialog.svelte';
	import AboutDialog from './components/AboutDialog.svelte';
	import MissingFilesDialog from './components/MissingFilesDialog.svelte';
	import StkInspectDialog from './components/StkInspectDialog.svelte';
	import ToastHost from './components/ToastHost.svelte';
	import Welcome from './components/Welcome.svelte';
import {
		newKit,
		openKit,
		saveKit,
		guardUnsaved,
		isDirty,
		unsavedOpen,
		unsavedResolve,
		missingDialogOpen,
		stkInspectOpen,
		project,
		projectPath,
		recentStore,
		setRecentUnsaved
	} from './stores/app';
	import { api } from './lib/commands';
	import { locale } from './lib/i18n';
	import { open } from '@tauri-apps/plugin-dialog';

	let showShortcuts = $state(false);
	let showAbout = $state(false);
	let showKitInformation = $state(false);
	let isWelcome = $derived(
		$project.kit.name === 'NewKit' &&
			Object.keys($project.kit.pads).length === 0 &&
			!$project.kit.notes &&
			!isDirty()
	);

	function onKey(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (mod && e.code === 'KeyN') {
			void guardUnsaved().then((ok) => ok && newKit());
			e.preventDefault();
			return;
		}
		if (mod && e.code === 'KeyO') {
			void openViaDialog();
			e.preventDefault();
			return;
		}
		if (mod && e.shiftKey && e.code === 'KeyS') {
			void saveKit();
			e.preventDefault();
			return;
		}
		if (mod && e.code === 'KeyS') {
			void saveKit();
			e.preventDefault();
			return;
		}
		if (mod && !e.shiftKey && e.code === 'KeyZ') {
			import('./stores/app').then((a) => a.undo());
			e.preventDefault();
			return;
		}
		if (mod && e.shiftKey && (e.code === 'KeyZ' || e.code === 'KeyY')) {
			import('./stores/app').then((a) => a.redo());
			e.preventDefault();
			return;
		}
		if (e.code === 'KeyF1') {
			showShortcuts = true;
			e.preventDefault();
			return;
		}
		if (e.code === 'Escape') {
			showShortcuts = false;
			return;
		}
	}

	async function openViaDialog() {
		const out = await open({
			multiple: false,
			filters: [{ name: 'SmplTrek Kit', extensions: ['json'] }],
		});
		if (!out) return;
		if (await guardUnsaved()) await openKit(out as string);
	}

	function beforeUnload(e: BeforeUnloadEvent) {
		if (isDirty()) {
			e.preventDefault();
			e.returnValue = '';
		}
	}

	onMount(() => {
		window.addEventListener('keydown', onKey, { passive: false });
		window.addEventListener('beforeunload', beforeUnload);
		void api.loadRecent().then((s) => recentStore.set(s));

		// Tauri close hook (S13) — intercept window close when dirty
		let unlisten: (() => void) | null = null;
		let unlistenAbout: (() => void) | null = null;
		(async () => {
			try {
				const { getCurrentWindow } = await import('@tauri-apps/api/window');
				const win = getCurrentWindow();
				unlisten = await win.onCloseRequested(async (event) => {
					if (isDirty()) {
						event.preventDefault();
						const ok = await guardUnsaved();
						if (ok) {
							// If user chose discard, mark recent entry as unsaved
							const path = get(projectPath);
							if (path) await setRecentUnsaved(path, true);
							await win.close();
						}
					}
				});
			} catch {
				// Running in browser (vite dev without Tauri) — ignore
			}
		})();

		void import('@tauri-apps/api/event').then(({ listen }) => listen('open-about', () => { showAbout = true; }).then((stop) => (unlistenAbout = stop))).catch(() => {});

		return () => {
			if (unlisten) unlisten();
			if (unlistenAbout) unlistenAbout();
		};
	});
</script>

<div class="app-root">
	{#key $locale}
		<TopBar
			onKitInformation={() => (showKitInformation = true)}
			onAbout={() => (showAbout = true)}
			onShortcuts={() => (showShortcuts = true)}
		/>
	<main class="workspace">
		{#if isWelcome}
			<Welcome />
		{:else}
			<section class="stage">
				<DeviceView />
				<AudioExplorer />
			</section>
		{/if}
	</main>
	<ShortcutsDialog open={showShortcuts} onClose={() => (showShortcuts = false)} />
	<AboutDialog open={showAbout} onClose={() => (showAbout = false)} />
	<KitInformationDialog open={showKitInformation} onClose={() => (showKitInformation = false)} />
	<MissingFilesDialog open={$missingDialogOpen} onClose={() => missingDialogOpen.set(false)} />
	<StkInspectDialog open={$stkInspectOpen} onClose={() => stkInspectOpen.set(false)} />
	<UnsavedDialog open={$unsavedOpen} onConfirm={unsavedResolve} />
		<ToastHost />
	{/key}
</div>

<style>
	.app-root {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg, #1a1d21);
		color: var(--fg, #e6e6e6);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}
	:global(html[data-zoom-mode='css']) .app-root { height: calc(100vh / var(--ui-scale)); }
	.workspace {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		overflow-x: auto;
		overflow-y: hidden;
	}
	.stage {
		display: flex;
		height: 100%;
		width: 100%;
		gap: 0;
	}
</style>
