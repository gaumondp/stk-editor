// Escape-to-close action for modal dialogs (a11y).
/**
 * Svelte action that invokes a callback when the user presses Escape while the
 * modal element (or any of its descendants) is the active focus context.
 *
 * The listener is bound to the modal node itself rather than the window, so it
 * only fires for the currently mounted, focus-trapped dialog and never conflicts
 * with global shortcut handling. It stops propagation once handled so a single
 * Escape closes one dialog at a time. Pair it with the `focusTrap` action, which
 * keeps keyboard focus inside the modal so the keydown reaches this node.
 *
 * @param node The modal container element the action is applied to.
 * @param onEscape Callback run when Escape is pressed. For a destructive-choice
 *   dialog, wire this to the non-destructive (cancel) path, never to discard.
 * @returns A Svelte action object exposing `update` (to swap the callback) and
 *   `destroy` (to detach the listener).
 */
export function dismissable(node: HTMLElement, onEscape: () => void) {
	let handler = onEscape;

	function onKeyDown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.stopPropagation();
		e.preventDefault();
		handler();
	}

	node.addEventListener('keydown', onKeyDown as EventListener);

	return {
		update(next: () => void) {
			handler = next;
		},
		destroy() {
			node.removeEventListener('keydown', onKeyDown as EventListener);
		}
	};
}
