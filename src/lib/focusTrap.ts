// Focus trap action for modal dialogs (S05)
export function focusTrap(node: HTMLElement) {
	const selector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

	function getFocusable(): HTMLElement[] {
		return Array.from(node.querySelectorAll<HTMLElement>(selector)).filter(
			(el) => el.offsetParent !== null || el === document.activeElement
		);
	}

	const previous = document.activeElement as HTMLElement | null;

	// Focus first element on mount
	queueMicrotask(() => {
		const focusable = getFocusable();
		if (focusable.length) focusable[0].focus();
		else (node as HTMLElement).focus();
	});

	function onKeyDown(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;
		const focusable = getFocusable();
		if (!focusable.length) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (e.shiftKey) {
			if (document.activeElement === first) {
				e.preventDefault();
				last.focus();
			}
		} else {
			if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	node.addEventListener('keydown', onKeyDown as EventListener);

	return {
		destroy() {
			node.removeEventListener('keydown', onKeyDown as EventListener);
			if (previous && typeof previous.focus === 'function') {
				try {
					previous.focus();
				} catch {}
			}
		}
	};
}
