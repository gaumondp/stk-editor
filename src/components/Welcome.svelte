<svelte:options runes />

<script lang="ts">
	import { tr } from '../lib/i18n';
	import { newKit, openKit, openRecent, recentStore, stkInspectOpen } from '../stores/app';
	import { open } from '@tauri-apps/plugin-dialog';

	async function doNew() {
		newKit('NewKit');
	}

	async function doOpen() {
		const picked = await open({ filters: [{ name: 'SmplTrek Kit', extensions: ['json'] }] });
		if (picked) await openKit(picked as string);
	}

	const recentProjects = $derived(
		$recentStore.entries
			.filter((project) => project.path.trim().length > 0 && !project.missing)
			.slice(0, 5)
	);

	async function doOpenRecent(path: string) {
		await openRecent(path);
	}

	function recentProjectLabel(path: string, fallback: string) {
		return path.split(/[\\/]/).pop() || fallback;
	}
</script>

<div class="welcome">
	<h1>{tr('app.title')}</h1>
	<p class="subtitle">{tr('welcome.description')}</p>

	<div class="actions">
		<button class="btn primary" type="button" onclick={doNew}>{tr('menu.new')}</button>
		<button class="btn" type="button" onclick={doOpen}>{tr('menu.open')}</button>
		<button class="btn" type="button" onclick={() => stkInspectOpen.set(true)}>{tr('menu.open_compiled')}</button>
	</div>

	{#if recentProjects.length}
		<p class="recent-title">Kits récents:</p>
		<ul class="recent-projects" aria-label={tr('menu.recent')}>
			{#each recentProjects as project}
				<li>
					<button class="recent-project" type="button" title={project.path} onclick={() => void doOpenRecent(project.path)}>{recentProjectLabel(project.path, project.name)}</button>
				</li>
			{/each}
		</ul>
	{/if}

	<p class="hint">{tr('welcome.hint')}</p>
</div>

<style>
	.welcome {
		max-width: 560px;
		margin: 40px auto;
		padding: 32px;
		background: var(--bg-2, #23272b);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 12px;
		text-align: center;
	}
	h1 { margin: 0 0 6px; font-size: 22px; }
	.subtitle { color: var(--fg-dim, #9aa0a6); margin: 0 0 20px; font-size: 13px; }
	.actions { display: flex; gap: 10px; justify-content: center; margin-bottom: 12px; }
	.recent-title { margin: 0 0 6px; color: var(--fg-dim, #9aa0a6); font-size: 12px; font-weight: 600; text-align: left; }
	.recent-projects { list-style: none; margin: 0; padding: 0; text-align: left; }
	.recent-projects li + li { margin-top: 4px; }
	.recent-project { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 7px 9px; border: 1px solid var(--line, #3a3f45); border-radius: 5px; background: var(--bg-3, #2e3338); color: var(--fg, #e6e6e6); cursor: pointer; text-align: left; }
	.recent-project:hover { border-color: var(--accent, #d2a83f); }
	.btn { padding: 8px 16px; border-radius: 6px; border: 1px solid var(--line, #3a3f45); background: var(--bg-3, #2e3338); color: var(--fg, #e6e6e6); cursor: pointer; }
	.btn.primary { background: var(--accent, #d2a83f); color: #1a1d21; border-color: var(--accent); font-weight: 600; }
	.hint { font-size: 11px; color: var(--fg-dim); margin-top: 18px; line-height: 1.4; }
</style>
