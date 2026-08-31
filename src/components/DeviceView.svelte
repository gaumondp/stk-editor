<svelte:options runes />

<script lang="ts">
	import { project, assignSample, clearSamples, moveOrSwapSample, removeSample, setParam } from '../stores/app';
	import type { Sample } from '../lib/commands';
	import { onMount, tick } from 'svelte';
	import { tr } from '../lib/i18n';
	import { previewingPath, previewMuted, previewWav, setPreviewMuted, stopPreview } from '../lib/audio-preview';
	import { padIdFromDropTarget } from '../lib/drop-target';
	import PadParameterEditor from './PadParameterEditor.svelte';
	import type { PadParameter } from '../lib/pad-parameters';

	let { onReadSdCard = () => {} }: { onReadSdCard?: () => void } = $props();

	const assignablePadIds = Array.from({ length: 15 }, (_, index) => index + 1);
	const trackRows = [
		[
			{ id: 1, label: 'TRK 1' }, { id: 2, label: 'TRK 2' }, { id: 3, label: 'TRK 3' }, { id: 4, label: 'TRK 4' },
			{ id: 5, label: 'TRK 5' }, { id: 6, label: 'TRK 6' }, { id: 7, label: 'TRK 7' }
		],
		[
			{ id: 8, label: 'TRK 8' }, { id: 9, label: 'TRK 9' }, { id: 10, label: 'TRK 10' }, { id: 11, label: 'GLOBAL 1' },
			{ id: 12, label: 'GLOBAL 2' }, { id: 13, label: 'GLOBAL 3' }, { id: 14, label: 'USB AUDIO' }, { id: 15, label: 'EXT SRC' }
		]
	];

	let selectPad = $state<number | null>(null);
	let dragOverPad = $state<number | null>(null);
	let dragSourcePad = $state<number | null>(null);
	let showSuggestedPadPositions = $state(true);
	let suppressPadClickUntil = 0;
	const previewingPad = $derived.by(() => {
		for (const id of assignablePadIds) {
			const sample = $project.kit.pads[id];
			const path = sample?.resolved_path ?? sample?.original_path;
			if (path === $previewingPath) return id;
		}
		return null;
	});

	// The sample bound to the parameter editor: the assignment on the currently
	// selected pad, or undefined when no pad (or an empty pad) is selected.
	const selectedSample = $derived(selectPad === null ? undefined : $project.kit.pads[selectPad]);

	/** Commits an edited pad parameter only while a selected assigned pad is still current. */
	function commitPadParameter(param: PadParameter, value: number) {
		if (selectPad === null || !$project.kit.pads[selectPad]) return;
		void setParam(selectPad, param, value);
	}

	onMount(() => {
		const onKey = (event: KeyboardEvent) => handleGlobalKeyDown(event);
		const onAudioDragMove = (event: Event) => handleInternalAudioDragMove(event);
		const onAudioDragEnd = (event: Event) => handleInternalAudioDragEnd(event);
		const onAudioDragCancel = () => handleInternalAudioDragCancel();
		const onAssignedPadDragMove = (event: Event) => handleAssignedPadDragMove(event);
		const onAssignedPadDragEnd = (event: Event) => handleAssignedPadDragEnd(event);
		const onAssignedPadDragCancel = () => handleAssignedPadDragCancel();
		window.addEventListener('keydown', onKey);
		window.addEventListener('smpltrek-audio-drag-move', onAudioDragMove);
		window.addEventListener('smpltrek-audio-drag-end', onAudioDragEnd);
		window.addEventListener('smpltrek-audio-drag-cancel', onAudioDragCancel);
		window.addEventListener('smpltrek-assigned-pad-drag-move', onAssignedPadDragMove);
		window.addEventListener('smpltrek-assigned-pad-drag-end', onAssignedPadDragEnd);
		window.addEventListener('smpltrek-assigned-pad-drag-cancel', onAssignedPadDragCancel);
		let unlistenNativeDrop: (() => void) | null = null;
		void import('@tauri-apps/api/window')
			.then(({ getCurrentWindow }) => getCurrentWindow().onDragDropEvent((event) => handleNativeDragDrop(event.payload)))
			.then((unlisten) => (unlistenNativeDrop = unlisten))
			.catch(() => {});
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('smpltrek-audio-drag-move', onAudioDragMove);
			window.removeEventListener('smpltrek-audio-drag-end', onAudioDragEnd);
			window.removeEventListener('smpltrek-audio-drag-cancel', onAudioDragCancel);
			window.removeEventListener('smpltrek-assigned-pad-drag-move', onAssignedPadDragMove);
			window.removeEventListener('smpltrek-assigned-pad-drag-end', onAssignedPadDragEnd);
			window.removeEventListener('smpltrek-assigned-pad-drag-cancel', onAssignedPadDragCancel);
			unlistenNativeDrop?.();
			stopPreview();
		};
	});

	/** Clears every pad assignment in one undoable action without deleting source WAV files. */
	function clearPadAssignments() {
		stopPreview();
		selectPad = null;
		void clearSamples();
	}

	/** Toggles the muted state of the shared Explorer and pad preview player. */
	function togglePreviewMute() {
		setPreviewMuted(!$previewMuted);
	}

	/** Toggles the visible default drum-position suggestions below the physical pads. */
	function toggleSuggestedPadPositions() {
		showSuggestedPadPositions = !showSuggestedPadPositions;
	}

	/** Handles selection and Cmd/Ctrl-delete for an assignment-list row or physical pad. */
	function handlePadClick(id: number, event: MouseEvent) {
		if (performance.now() < suppressPadClickUntil) return;
		if (event.metaKey || event.ctrlKey) {
			void removeSample(id);
			selectPad = null;
			stopPreview();
			return;
		}
		selectPad = id;
	}

	/** Removes a linked sample from the assignment list. */
	function handleAssignedSampleRemove(id: number) {
		if (previewingPad === id) stopPreview();
		void removeSample(id);
		if (selectPad === id) selectPad = null;
	}

	/** Starts an always-available drag from the named assignment row after a small movement threshold. */
	function handleAssignedPadMouseDown(sourcePad: number, event: MouseEvent) {
		if (event.button !== 0 || !$project.kit.pads[sourcePad]) return;
		event.preventDefault();
		const startX = event.clientX;
		const startY = event.clientY;
		let active = false;
		const cleanup = () => {
			window.removeEventListener('mousemove', onMouseMove, true);
			window.removeEventListener('mouseup', onMouseUp, true);
			window.removeEventListener('blur', onWindowBlur);
		};
		const onMouseMove = (moveEvent: MouseEvent) => {
			if (!active && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
			active = true;
			dragSourcePad = sourcePad;
			moveEvent.preventDefault();
			window.dispatchEvent(new CustomEvent('smpltrek-assigned-pad-drag-move', {
				detail: { sourcePad, clientX: moveEvent.clientX, clientY: moveEvent.clientY }
			}));
		};
		const onMouseUp = (upEvent: MouseEvent) => {
			cleanup();
			if (!active) return;
			upEvent.preventDefault();
			suppressPadClickUntil = performance.now() + 250;
			window.dispatchEvent(new CustomEvent('smpltrek-assigned-pad-drag-end', {
				detail: { sourcePad, clientX: upEvent.clientX, clientY: upEvent.clientY }
			}));
		};
		const onWindowBlur = () => {
			cleanup();
			if (active) window.dispatchEvent(new CustomEvent('smpltrek-assigned-pad-drag-cancel'));
		};
		window.addEventListener('mousemove', onMouseMove, true);
		window.addEventListener('mouseup', onMouseUp, true);
		window.addEventListener('blur', onWindowBlur);
	}

	/** Highlights the target for an existing assignment while it is dragged. */
	function handleAssignedPadDragMove(event: Event) {
		const detail = (event as CustomEvent<{ sourcePad?: number; clientX?: number; clientY?: number }>).detail;
		if (detail?.sourcePad == null || detail.clientX == null || detail.clientY == null) return;
		dragSourcePad = detail.sourcePad;
		const target = padIdFromDropTarget(document.elementFromPoint(detail.clientX, detail.clientY));
		dragOverPad = target === detail.sourcePad ? null : target;
	}

	/** Moves an assignment to an empty pad or swaps complete assignments on an occupied pad. */
	function handleAssignedPadDragEnd(event: Event) {
		const detail = (event as CustomEvent<{ sourcePad?: number; clientX?: number; clientY?: number }>).detail;
		if (detail?.sourcePad != null && detail.clientX != null && detail.clientY != null) {
			const target = padIdFromDropTarget(document.elementFromPoint(detail.clientX, detail.clientY));
			if (target !== null && target !== detail.sourcePad) {
				void moveOrSwapSample(detail.sourcePad, target);
				selectPad = target;
			}
		}
		dragOverPad = null;
		dragSourcePad = null;
	}

	/** Clears an incomplete existing-pad drag without changing any assignment. */
	function handleAssignedPadDragCancel() {
		dragOverPad = null;
		dragSourcePad = null;
	}

	/** Plays or stops the sample assigned to a physical pad. */
	function handlePadDoubleClick(id: number) {
		togglePreview(id);
	}

	/** Supports keyboard selection from either the assignment list or physical facade. */
	function handlePadKeyDown(id: number, event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			selectPad = id;
			if (event.key === 'Enter') togglePreview(id);
		}
	}

	/** Extracts a dropped audio path and commits it to the selected assignable pad. */
	async function handlePadDrop(id: number, event: DragEvent | null, droppedPath?: string) {
		dragOverPad = null;
		if (!assignablePadIds.includes(id)) return;
		let data: string | null = droppedPath ?? event?.dataTransfer?.getData('text/plain') ?? null;
		if (!data) data = event?.dataTransfer?.getData('text/uri-list') ?? null;
		if (data?.startsWith('file://')) {
			try { data = decodeURI(new URL(data.split('\n')[0].trim()).pathname); } catch {}
		}
		if (!data && event?.dataTransfer?.files?.length) {
			const file = event.dataTransfer.files[0] as unknown as { path?: string; name: string };
			data = file.path ?? file.name ?? null;
		}
		if (!data) return;

		const existing = $project.kit.pads[id];
		if (existing) {
			const isCustom = existing.volume !== 100 || existing.pan !== 0 || existing.pitch !== 0 || existing.fx_send !== 0 || !!existing.note;
			if (isCustom) {
				try {
					const { ask } = await import('@tauri-apps/plugin-dialog');
					const ok = await ask(`Pad ${id} already has custom params (vol ${existing.volume}, pan ${existing.pan}). Replace?`, {
						title: 'Replace sample?', kind: 'warning'
					});
					if (!ok) return;
				} catch {}
			}
		}

		const fileName = data.split(/[\\/]/).pop() ?? data;
		const sample: Sample = {
			id: `${id}-${Date.now()}`,
			file_name: fileName,
			original_file_name: fileName,
			resolved_path: data,
			original_path: data,
			volume: 100,
			pan: 0,
			pitch: 0,
			fx_send: 0
		};
		await assignSample(id, sample, !!existing);
		await tick();
		if ($project.kit.pads[id]?.id !== sample.id) {
			return;
		}
		selectPad = id;
	}


	/** Highlights the assignment-list row or physical pad currently under the dragged WAV. */
	function handleInternalAudioDragMove(event: Event) {
		dragSourcePad = null;
		const detail = (event as CustomEvent<{ clientX?: number; clientY?: number }>).detail;
		if (detail?.clientX == null || detail.clientY == null) return;
		dragOverPad = padIdFromDropTarget(document.elementFromPoint(detail.clientX, detail.clientY));
	}

	/** Clears an incomplete internal drag without assigning a sample. */
	function handleInternalAudioDragCancel() {
		dragOverPad = null;
		dragSourcePad = null;
	}

	/** Assigns the dragged WAV to the resolved assignment target. */
	function handleInternalAudioDragEnd(event: Event) {
		dragSourcePad = null;
		const detail = (event as CustomEvent<{ path?: string; clientX?: number; clientY?: number }>).detail;
		if (!detail?.path || detail.clientX == null || detail.clientY == null) return;
		const id = padIdFromDropTarget(document.elementFromPoint(detail.clientX, detail.clientY));
		if (id === null) {
			dragOverPad = null;
			return;
		}
		void handlePadDrop(id, null, detail.path).catch((error) => {
			console.error('[audio-drag-assignment]', error);
		});
	}

	/** Resolves native Finder drop coordinates against either a list row or physical pad. */
	function padIdFromNativePosition(position: { x: number; y: number }) {
		const scale = window.devicePixelRatio || 1;
		return padIdFromDropTarget(document.elementFromPoint(position.x / scale, position.y / scale));
	}

	/** Preserves the separate Tauri/Finder file drop path. */
	function handleNativeDragDrop(payload: { type: 'enter'; paths: string[]; position: { x: number; y: number } } | { type: 'over'; position: { x: number; y: number } } | { type: 'drop'; paths: string[]; position: { x: number; y: number } } | { type: 'leave' }) {
		if (payload.type === 'leave') {
			dragOverPad = null;
			return;
		}
		const id = padIdFromNativePosition(payload.position);
		if (payload.type === 'drop') {
			dragOverPad = null;
			if (id !== null && payload.paths[0]) void handlePadDrop(id, null, payload.paths[0]);
			return;
		}
		dragOverPad = id;
	}

	/** Toggles preview playback for a sample already associated with a pad. */
	function togglePreview(id: number) {
		const sample = $project.kit.pads[id];
		const path = sample?.resolved_path ?? sample?.original_path;
		if (path) void previewWav(path);
	}

	/** Provides keyboard navigation across the two physical rows of eight pads. */
	function handleGlobalKeyDown(event: KeyboardEvent) {
		const tag = (document.activeElement?.tagName ?? '').toLowerCase();
		const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement as HTMLElement)?.isContentEditable;
		if (selectPad == null) {
			if (event.code === 'Escape') stopPreview();
			return;
		}
		if (event.code === 'Delete' || event.code === 'Backspace') {
			if (isInput) return;
			event.preventDefault();
			void removeSample(selectPad);
			stopPreview();
			selectPad = null;
			return;
		}
		if (event.code === 'Space') {
			if (isInput) return;
			event.preventDefault();
			togglePreview(selectPad);
			return;
		}
		if (event.code === 'Escape') {
			event.preventDefault();
			stopPreview();
			return;
		}
		if (isInput || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) return;
		event.preventDefault();
		let next = selectPad;
		if (event.code === 'ArrowLeft') next -= 1;
		if (event.code === 'ArrowRight') next += 1;
		if (event.code === 'ArrowUp') next -= 8;
		if (event.code === 'ArrowDown') next += 8;
		if (next < 1) next = 1;
		if (next > 15) next = 15;
		selectPad = next;
	}

</script>

<section class="device">
	<div class="device-wrap">
		<section class="assignment-panel" aria-label={tr('pad.assignments_title')}>
			<div class="assignment-heading">
				<div>
					<h2>{tr('pad.assignments_title')}</h2>
					<p>{tr('pad.assignments_description')}</p>
				</div>
				<span class="assignment-count">{tr('pad.assigned_count', { count: assignablePadIds.filter((id) => !!$project.kit.pads[id]).length })}</span>
			</div>
			<div class="assignment-list">
				{#each assignablePadIds as id}
					{@const sample = $project.kit.pads[id]}
					<div
						class="assignment-target"
						class:assigned={!!sample}
						class:dragover={dragOverPad === id}
						class:drag-source={dragSourcePad === id}
						class:selected={selectPad === id}
						data-pad={id}
						role="button"
						tabindex="0"
						aria-label={`Pad ${id}`}
						onmousedown={(event) => { if (sample) handleAssignedPadMouseDown(id, event); }}
						onclick={(event) => handlePadClick(id, event)}
						ondblclick={() => handlePadDoubleClick(id)}
						onkeydown={(event) => handlePadKeyDown(id, event)}>
						<span class="assignment-number">{String(id).padStart(2, '0')}</span>
						<span class="assignment-name" class:empty={!sample}>{sample?.file_name ?? tr('pad.ready')}</span>
						{#if sample}
							<button class="assignment-remove" type="button" aria-label={tr('pad.remove', { pad: id })} title={tr('pad.remove', { pad: id })} onmousedown={(event) => event.stopPropagation()} onclick={(event) => { event.stopPropagation(); handleAssignedSampleRemove(id); }}>×</button>
						{:else}
							<span class="assignment-state">{tr('pad.drop_here')}</span>
						{/if}
					</div>
				{/each}
			</div>
			<PadParameterEditor selectedPad={selectPad} sample={selectedSample} onCommit={commitPadParameter} />
		</section>

		<section class="physical-pad-section" aria-label="Physical pads">
			<div class="physical-pad-layout">
				<div class="pad-actions">
					<button class="pad-action clear" type="button" onclick={clearPadAssignments}>{tr('pad.clear_all')}</button>
					<button class="pad-action mute" class:active={$previewMuted} type="button" onclick={togglePreviewMute} aria-pressed={$previewMuted} aria-label={tr($previewMuted ? 'pad.unmute_preview' : 'pad.mute_preview')} title={tr($previewMuted ? 'pad.unmute_preview' : 'pad.mute_preview')}>
						<span aria-hidden="true">{$previewMuted ? '🔇' : '🔊'}</span>
						<span>{tr($previewMuted ? 'pad.unmute_preview' : 'pad.mute_preview')}</span>
					</button>
					<button class="pad-action suggestions" type="button" onclick={toggleSuggestedPadPositions} aria-pressed={showSuggestedPadPositions}>
						{tr(showSuggestedPadPositions ? 'pad.hide_suggestions' : 'pad.show_suggestions')}
					</button>
					<button class="pad-action sd-reader-action" type="button" onclick={onReadSdCard}>
						<svg class="sd-reader-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M16 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7z" />
							<path d="M16 3v4" />
							<path d="M12.5 6v2" />
							<path d="M15 6v2" />
						</svg>
						<span>{tr('sd_reader.open')}</span>
					</button>
				</div>
				<svg class="pads-svg" viewBox="0 0 700 220" role="group" aria-label="Physical pads" preserveAspectRatio="xMidYMid meet">
					<g class="track-grid">
						{#each trackRows as row, rowIndex}
							{#each row as pad, index}
								{@const x = rowIndex === 0 ? 112 + index * 78 : 70 + index * 78}
								{@const labelY = rowIndex === 0 ? 24 : 124}
								{@const padY = rowIndex === 0 ? 32 : 132}
								<g class="track-pad" class:assigned={!!$project.kit.pads[pad.id]} class:selected={selectPad === pad.id} class:dragover={dragOverPad === pad.id} class:drag-source={dragSourcePad === pad.id} class:previewing={previewingPad === pad.id} data-pad={pad.id} role="button" tabindex="0" aria-label={`Pad ${pad.id}: ${pad.label}`} onmousedown={(event) => { if ($project.kit.pads[pad.id]) handleAssignedPadMouseDown(pad.id, event); }} onclick={(event) => handlePadClick(pad.id, event)} ondblclick={() => handlePadDoubleClick(pad.id)} onkeydown={(event) => handlePadKeyDown(pad.id, event)}>
									<text x={x} y={labelY} text-anchor="middle">{pad.label}</text><rect x={x - 28} y={padY} width="56" height="58" rx="8"/><text class="pad-number" x={x} y={padY + 29} text-anchor="middle" dominant-baseline="middle" font-size="28" aria-hidden="true">{pad.id}</text>
								</g>
							{/each}
						{/each}
						{#if showSuggestedPadPositions}
							<g data-testid="suggested-pad-positions" aria-label={tr('pad.suggestions_title')}>
								{#each trackRows as row, rowIndex}
									{#each row as pad, index}
										{@const x = rowIndex === 0 ? 112 + index * 78 : 70 + index * 78}
										<text class="pad-suggestion" x={x} y={rowIndex === 0 ? 105 : 205} text-anchor="middle" aria-label={tr(`pad.suggestion_${pad.id}`)}><title>{tr(`pad.suggestion_${pad.id}`)}</title>{tr(`pad.suggestion_${pad.id}_short`)}</text>
									{/each}
								{/each}
							</g>
						{/if}
					</g>
				</svg>
			</div>
		</section>

		<div class="pads-hint">{tr('pad.preview_hint')}</div>
	</div>
</section>

<style>
	.device { width: 100%; padding: 12px; display: flex; align-items: flex-start; justify-content: center; }
	:global(html[data-ui-scale='125']) .device,
	:global(html[data-ui-scale='150']) .device,
	:global(html[data-ui-scale='200']) .device { justify-content: flex-start; }
	.device-wrap { width: min(100%, 820px); }
	.assignment-panel { box-sizing: border-box; width: 100%; margin-bottom: 14px; padding: 12px; border: 1px solid var(--line, #3a3f45); border-radius: 10px; background: var(--bg-2, #23272b); }
	.assignment-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
	.assignment-heading h2 { margin: 0; color: var(--fg, #e6e6e6); font-size: 18px; }
	.assignment-heading p { margin: 4px 0 0; color: var(--fg-dim, #9aa0a6); font-size: 12px; }
	.assignment-count { padding: 4px 8px; border-radius: 99px; background: var(--bg-3, #2e3338); color: var(--fg-dim, #9aa0a6); font-size: 11px; white-space: nowrap; }
	.assignment-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
	.assignment-target { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: 7px; min-height: 34px; padding: 5px 7px; border: 1px dashed var(--line, #3a3f45); border-radius: 5px; background: var(--bg, #1a1d21); color: var(--fg, #e6e6e6); cursor: pointer; text-align: left; }
	.assignment-target:hover, .assignment-target.dragover { border-color: var(--accent-2, #4a90d2); background: rgba(74,144,210,.15); }
	.assignment-target.assigned { border-style: solid; border-color: var(--ok, #4caf50); background: rgba(76,175,80,.12); }
	.assignment-target.selected { outline: 2px solid var(--accent, #d2a83f); outline-offset: 1px; }
	.assignment-target.drag-source { border-color: var(--accent, #d2a83f); opacity: .65; }
	.assignment-number { color: var(--fg-dim, #9aa0a6); font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700; }
	.assignment-name { overflow: hidden; color: var(--fg, #e6e6e6); font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
	.assignment-name.empty { color: var(--fg-dim, #9aa0a6); font-weight: 400; }
	.assignment-state { color: var(--fg-dim, #9aa0a6); font-size: 9px; text-transform: uppercase; }
	.assignment-remove { width: 20px; height: 20px; border: 0; border-radius: 4px; background: transparent; color: var(--fg-dim, #9aa0a6); cursor: pointer; font-size: 16px; line-height: 1; }
	.assignment-remove:hover, .assignment-remove:focus-visible { background: rgba(255,255,255,.12); color: var(--fg, #e6e6e6); }
	.physical-pad-section { box-sizing: border-box; width: 100%; margin-top: 14px; }
	.physical-pad-layout { display: flex; align-items: center; gap: 10px; }
	.pad-actions { display: flex; flex: 0 0 96px; flex-direction: column; gap: 6px; }
	.pad-action { width: 100%; padding: 6px; border: 1px solid var(--line, #3a3f45); border-radius: 5px; background: var(--bg-3, #2e3338); color: var(--fg, #e6e6e6); cursor: pointer; font-size: 11px; }
	.pad-action.clear:hover { border-color: var(--err, #e74c3c); }
	.pad-action.mute { display: flex; align-items: center; justify-content: center; gap: 4px; height: calc(3 * 1.2em + 14px); line-height: 1.2; }
	.pad-action.mute.active { border-color: var(--warn, #f0ad4e); background: rgba(240, 173, 78, 0.15); }
	.pad-action.suggestions { line-height: 1.2; }
	.pad-action.sd-reader-action { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 24px; }
	.sd-reader-icon { width: 16px; height: 16px; flex: 0 0 auto; }
	:global(html[data-ui-scale='125']) .physical-pad-layout, :global(html[data-ui-scale='150']) .physical-pad-layout, :global(html[data-ui-scale='200']) .physical-pad-layout { flex-direction: column; }
	:global(html[data-ui-scale='125']) .device-wrap, :global(html[data-ui-scale='150']) .device-wrap, :global(html[data-ui-scale='200']) .device-wrap { min-width: 680px; }
	:global(html[data-ui-scale='125']) .pad-actions, :global(html[data-ui-scale='150']) .pad-actions, :global(html[data-ui-scale='200']) .pad-actions { order: 1; flex: 0 0 auto; flex-direction: row; width: 100%; }
	:global(html[data-ui-scale='125']) .pad-action.sd-reader-action, :global(html[data-ui-scale='150']) .pad-action.sd-reader-action, :global(html[data-ui-scale='200']) .pad-action.sd-reader-action { margin-top: 0; margin-left: 24px; }
	.pads-svg { display: block; flex: 1; min-width: 0; height: auto; }
	.track-grid text { fill: var(--fg-dim, #9aa0a6); font-family: ui-monospace, monospace; font-size: 10px; font-weight: 700; pointer-events: none; user-select: none; -webkit-user-select: none; }
	.track-grid .pad-number { fill: var(--fg, #e6e6e6); font-size: 28px; opacity: 0.11; pointer-events: none; }
	.track-grid .pad-suggestion { fill: var(--fg, #e6e6e6); font-size: 10px; font-weight: 600; pointer-events: none; }
	.track-pad.assigned .pad-number, .track-pad.dragover .pad-number { fill: var(--bg, #1a1d21); }
	.track-pad { cursor: pointer; }
	.track-pad rect { fill: var(--bg-3, #2e3338); stroke: var(--line, #3a3f45); stroke-width: 2; }
	.track-pad.assigned rect { fill: var(--ok, #4caf50); stroke: var(--ok, #4caf50); }
	.track-pad.assigned text { fill: var(--ok, #4caf50); }
	.track-pad.dragover rect { fill: var(--accent-2, #4a90d2); stroke: var(--accent-2, #4a90d2); stroke-width: 4; }
	.track-pad.drag-source rect { stroke: var(--accent, #d2a83f); stroke-dasharray: 5 3; }
	.track-pad.dragover text { fill: var(--accent-2, #4a90d2); }
	.track-pad.selected rect { stroke: var(--accent, #d2a83f); stroke-width: 4; }
	.track-pad.previewing rect { animation: pulse 1s ease-in-out infinite; }
	.pads-hint { min-height: 16px; margin-top: 8px; color: var(--fg-dim, #9aa0a6); font-size: 11px; text-align: center; }
	@keyframes pulse { 50% { filter: brightness(1.5); } }
	@media (max-width: 650px) { .assignment-list { grid-template-columns: 1fr; } .assignment-target { min-height: 32px; } .physical-pad-layout { flex-direction: column; } .pad-actions { flex-direction: row; flex-basis: auto; width: 100%; } .pad-action.sd-reader-action { margin-top: 0; margin-left: 24px; } }
</style>
