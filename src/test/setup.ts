import '@testing-library/jest-dom/vitest';

const localStorageData = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
	configurable: true,
	value: {
		clear: () => localStorageData.clear(),
		getItem: (key: string) => localStorageData.get(key) ?? null,
		key: (index: number) => [...localStorageData.keys()][index] ?? null,
		removeItem: (key: string) => localStorageData.delete(key),
		setItem: (key: string, value: string) => localStorageData.set(key, String(value)),
		get length() { return localStorageData.size; }
	}
});

// Mock Tauri API for unit tests (no Rust backend)
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(async () => ({})),
	convertFileSrc: (p: string) => `http://asset.localhost/${p}`
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
	open: vi.fn(async () => null),
	save: vi.fn(async () => null),
	ask: vi.fn(async () => false),
	confirm: vi.fn(async () => false),
	message: vi.fn(async () => {})
}));

vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => ({
		onCloseRequested: vi.fn(async () => () => {}),
		close: vi.fn(async () => {})
	})
}));
