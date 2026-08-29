import { afterEach, describe, expect, it } from 'vitest';
import { dirty, guardUnsaved, markDirty, setSaved, unsavedResolve } from './app';
import { get } from 'svelte/store';

describe('guardUnsaved', () => {
	afterEach(() => setSaved());

	it('clears dirty state after discarding changes', async () => {
		markDirty();
		const guarded = guardUnsaved();
		unsavedResolve('discard');

		await expect(guarded).resolves.toBe(true);
		expect(get(dirty)).toBe(false);
	});
});
