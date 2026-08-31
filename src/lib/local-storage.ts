/**
 * Reads a STK Forge preference and copies the legacy STK Editor value only when
 * the STK Forge key does not already exist. The old key remains untouched.
 *
 * @param key The new STK Forge localStorage key.
 * @param legacyKey The former STK Editor localStorage key.
 * @returns The new or migrated value, or null when neither key exists.
 */
export function readMigratedStorage(key: string, legacyKey: string): string | null {
	try {
		const current = localStorage.getItem(key);
		if (current !== null) return current;
		const legacy = localStorage.getItem(legacyKey);
		if (legacy !== null) localStorage.setItem(key, legacy);
		return legacy;
	} catch {
		return null;
	}
}

/** Copies every namespaced STK Editor UI preference to its STK Forge key once. */
export function migrateStkEditorPreferences(): void {
	readMigratedStorage('stk-forge.theme', 'stk-editor.theme');
	readMigratedStorage('stk-forge.ui-scale', 'stk-editor.ui-scale');
	readMigratedStorage('stk-forge.audio-explorer.columns', 'stk-editor.audio-explorer.columns');
	readMigratedStorage('stk-forge.audio-explorer.visual-width.v2', 'stk-editor.audio-explorer.visual-width.v2');
	readMigratedStorage('stk-forge.preview-volume', 'stk-editor.preview-volume');
	readMigratedStorage('stk-forge.preview-muted', 'stk-editor.preview-muted');
}
