/**
 * Resolves the pad number for a drop target by walking up to the nearest ancestor
 * carrying a numeric `data-pad` attribute.
 *
 * @param target The event target under the pointer, or `null`.
 * @returns The pad number, or `null` when no valid `data-pad` ancestor exists.
 */
export function padIdFromDropTarget(target: EventTarget | null): number | null {
	if (!(target instanceof Element)) return null;
	const value = target.closest('[data-pad]')?.getAttribute('data-pad');
	if (!value || !/^\d+$/.test(value)) return null;
	return Number(value);
}
