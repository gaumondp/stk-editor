export function padIdFromDropTarget(target: EventTarget | null): number | null {
	if (!(target instanceof Element)) return null;
	const value = target.closest('[data-pad]')?.getAttribute('data-pad');
	if (!value || !/^\d+$/.test(value)) return null;
	return Number(value);
}
