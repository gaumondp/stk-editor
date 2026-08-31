// Shared pointer-drag mechanism for the two copy-pasted drag flows: dragging a
// WAV out of the Audio Explorer and dragging an assigned sample between pads.
// Both wire the same global mousemove/mouseup/blur listeners, wait for the same
// small movement before treating a press as a drag, and suppress the synthetic
// click that follows a drag for the same short window. This module owns that
// mechanism once; each caller supplies only its own move/end/cancel behaviour.

/**
 * Pixels the pointer must travel from the mousedown point before a press is
 * treated as a drag rather than a click. Below this, the gesture stays a click.
 */
export const DRAG_ACTIVATION_THRESHOLD_PX = 6;

/**
 * Milliseconds after a drag ends during which the trailing synthetic click is
 * suppressed, so releasing a drag never also fires the element's click handler.
 */
export const CLICK_SUPPRESSION_MS = 250;

/** Callbacks a caller supplies to react to the phases of a pointer drag. */
export interface PointerDragHandlers {
	/**
	 * Called once per mousemove after the drag has activated (i.e. once the
	 * pointer has passed {@link DRAG_ACTIVATION_THRESHOLD_PX}). The move event's
	 * `preventDefault` has already been called before this runs.
	 *
	 * @param event The live mousemove event.
	 */
	onMove(event: MouseEvent): void;
	/**
	 * Called on mouseup, but only when the drag actually activated. A press that
	 * never moved past the threshold releases without calling this. The up event's
	 * `preventDefault` has already been called before this runs.
	 *
	 * @param event The mouseup event.
	 */
	onEnd(event: MouseEvent): void;
	/**
	 * Called when the drag is abandoned because the window lost focus mid-drag.
	 * Only fires when the drag had activated.
	 */
	onCancel(): void;
}

/** Handle returned by {@link startPointerDrag}, used to tear a session down early. */
export interface PointerDragSession {
	/** Detaches all global listeners early (e.g. when a new drag supersedes this one). */
	cancel(): void;
}

/**
 * Starts a global pointer-drag session on a left-button mousedown. Attaches
 * capturing `mousemove`/`mouseup` and a `blur` listener to `window`; the drag is
 * considered active only after the pointer moves past
 * {@link DRAG_ACTIVATION_THRESHOLD_PX}, at which point `handlers.onMove` fires per
 * move and `handlers.onEnd` fires on release. A press that never crosses the
 * threshold releases silently (a plain click), so the caller should drop the
 * synthetic click that follows a real drag by comparing `performance.now()`
 * against a deadline of `performance.now() + `{@link CLICK_SUPPRESSION_MS} set in
 * `onEnd`. Losing window focus mid-drag runs `handlers.onCancel`. All listeners
 * are removed on release, cancel, or blur.
 *
 * @param event The originating mousedown event. The caller should already have
 *   filtered non-left buttons and called `preventDefault` as needed; the start
 *   point is read from `event.clientX/clientY`.
 * @param handlers The caller's move/end/cancel callbacks.
 * @returns A session whose `cancel()` tears the listeners down early.
 */
export function startPointerDrag(event: MouseEvent, handlers: PointerDragHandlers): PointerDragSession {
	const startX = event.clientX;
	const startY = event.clientY;
	let active = false;

	const cleanup = () => {
		window.removeEventListener('mousemove', onMouseMove, true);
		window.removeEventListener('mouseup', onMouseUp, true);
		window.removeEventListener('blur', onWindowBlur);
	};

	const onMouseMove = (moveEvent: MouseEvent) => {
		if (!active && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_ACTIVATION_THRESHOLD_PX) {
			return;
		}
		active = true;
		moveEvent.preventDefault();
		handlers.onMove(moveEvent);
	};

	const onMouseUp = (upEvent: MouseEvent) => {
		cleanup();
		if (!active) return;
		upEvent.preventDefault();
		handlers.onEnd(upEvent);
	};

	const onWindowBlur = () => {
		cleanup();
		if (active) handlers.onCancel();
	};

	window.addEventListener('mousemove', onMouseMove, true);
	window.addEventListener('mouseup', onMouseUp, true);
	window.addEventListener('blur', onWindowBlur);

	return { cancel: cleanup };
}
