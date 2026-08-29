import { describe, expect, it } from 'vitest';
import { padIdFromDropTarget } from './drop-target';

describe('padIdFromDropTarget', () => {
	it('resolves a nested SVG element to its owning pad', () => {
		const pad = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		pad.dataset.pad = '7';
		const child = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		pad.append(child);

		expect(padIdFromDropTarget(child)).toBe(7);
	});

	it('rejects elements outside a pad', () => {
		expect(padIdFromDropTarget(document.createElement('div'))).toBeNull();
	});
});
