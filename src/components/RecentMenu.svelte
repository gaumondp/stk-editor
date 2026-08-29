<svelte:options runes />

<script lang="ts">
	import { recentStore } from '../stores/app';
	import { api } from '../lib/commands';
	import { tr } from '../lib/i18n';
	import { openRecent } from '../stores/app';

	let open = $state(false);
	let sortBy = $state<'opened' | 'modified'>(
		(typeof localStorage !== 'undefined' && (localStorage.getItem('recentSort') as 'opened' | 'modified')) || 'opened'
	);

	$effect(() => {
		try { localStorage.setItem('recentSort', sortBy); } catch {}
	});

	let sorted = $derived(
		[...$recentStore.entries].sort((a, b) => {
			const pa = parseInt(((sortBy === 'modified' ? a.last_modified : a.last_opened) ?? '0s').replace('s', '')) || 0;
			const pb = parseInt(((sortBy === 'modified' ? b.last_modified : b.last_opened) ?? '0s').replace('s', '')) || 0;
			return pb - pa;
		})
	);

	async function onOpen(path: string) {
		open = false;
		await openRecent(path);
	}

	async function onDelete(path: string) {
		await api.removeRecent(path);
		await api.loadRecent().then(recentStore.set);
	}

</script>

<div class="recent" part="menu">
	<button class="btn" type="button" onclick={() => (open = !open)} aria-haspopup="listbox">
		{tr('menu.recent')} ▾
	</button>
	{#if open}
		<div class="sort-row">
			<label>Sort:
				<select bind:value={sortBy}>
					<option value="opened">Last opened</option>
					<option value="modified">Last modified</option>
				</select>
			</label>
		</div>
		<ul class="recent-list" part="menu-list" role="listbox">
			{#each sorted.slice(0, 12) as e, i}
				<li role="option" class="recent-item {e.missing ? 'missing' : ''}"
					onclick={() => onOpen(e.path)}
					title={e.path}>
					<span class="idx">{i + 1}</span>
					<span class="name">{e.name}</span>
					{#if e.missing}
						<span class="badge missing">{tr('status.missing')}</span>
					{/if}
					{#if e.has_missing_files}
						<span class="badge warn">{tr('pad.missing')}</span>
					{/if}
					<button class="remove" type="button" onclick={(ev) => { ev.stopPropagation(); onDelete(e.path); }} title="Remove from list">×</button>
				</li>
			{/each}
			{#if !sorted.length}
				<li class="empty">—</li>
			{/if}
		</ul>
	{/if}
</div>

<style>
	.recent {
		position: relative;
	}
	.btn {
		background: var(--bg-3, #2e3338);
		color: var(--fg, #e6e6e6);
		border: 1px solid var(--line, #3a3f45);
		padding: 4px 10px;
		border-radius: 4px;
		cursor: pointer;
	}
	.recent-list {
		position: absolute;
		top: 100%;
		right: 0;
		background: var(--bg-2, #23272b);
		border: 1px solid var(--line, #3a3f45);
		border-radius: 6px;
		box-shadow: 0 8px 24px rgba(0,0,0,.4);
		min-width: 280px;
		max-height: 400px;
		overflow: auto;
		list-style: none;
		margin: 4px 0 0;
		padding: 4px;
		z-index: 50;
	}
	.recent-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 4px;
		cursor: pointer;
	}
	.recent-item:hover {
		background: var(--bg-3, #2e3338);
	}
	.idx {
		color: var(--fg-dim, #9aa0a6);
		font-size: 11px;
		width: 20px;
	}
	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badge {
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 10px;
	}
	.badge.missing {
		background: rgba(231,76,60,.2);
		color: #e74c3c;
	}
	.badge.warn {
		background: rgba(240,173,78,.2);
		color: #f0ad4e;
	}
	.recent-item.missing {
		opacity: 0.6;
	}
	.remove {
		background: none; border: none; color: var(--fg-dim, #9aa0a6);
		cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1;
	}
	.remove:hover { color: #e74c3c; }
	.sort-row {
		padding: 4px 8px;
		font-size: 11px;
		border-bottom: 1px solid var(--line, #3a3f45);
		margin: -4px -4px 4px;
	}
	.sort-row select {
		margin-left: 6px;
		background: var(--bg-3, #2e3338);
		color: var(--fg, #e6e6e6);
		border: 1px solid var(--line);
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 11px;
	}
	.empty {
		padding: 8px;
		color: var(--fg-dim, #9aa0a6);
		text-align: center;
	}
</style>