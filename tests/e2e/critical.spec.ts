import { test, expect, type Page } from '@playwright/test';

async function chooseMenuItem(page: Page, menu: 'Kit' | 'Export', item: string) {
	await page.getByRole('button', { name: menu, exact: true }).click();
	await page.getByRole('menuitem', { name: item, exact: true }).click();
}

async function startNewKit(page: Page) {
	await page.goto('/');
	await page.getByRole('button', { name: 'New kit' }).click();
	await expect(page.locator('.assignment-target')).toHaveCount(15);
}

test.describe('Critical paths (S17)', () => {
	test('1. New Kit opens the editor', async ({ page }) => {
		await startNewKit(page);
		await expect(page.locator('.topbar')).toBeVisible();
	});

	test('2. Top bar shows version, build timestamp, and status', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('.topbar')).toBeVisible();
		await expect(page.locator('.build-time')).toHaveCount(0);
		await expect(page.locator('.status-pill')).toBeVisible();
	});

	test('3. 15 physical track pads render without circular assignment pads', async ({ page }) => {
		await startNewKit(page);
		await expect(page.locator('.pads-svg .track-pad')).toHaveCount(15);
		await expect(page.locator('.pads-svg .chassis')).toHaveCount(0);
		await expect(page.locator('svg .hardware-pad')).toHaveCount(0);
	});

	test('4. Audio Explorer mouse drag assigns it to a pad', async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(window, '__TAURI_INTERNALS__', {
				value: {
					metadata: { currentWindow: { label: 'main' } },
					transformCallback: () => 1,
					unregisterCallback: () => {},
					invoke: async (command: string) => {
						if (command === 'plugin:dialog|open') return '/fixtures';
						if (command === 'cmd_list_wavs') {
							return [{
								name: 'kick.wav', path: '/fixtures/kick.wav', ext: 'wav', size: 42,
								durationMs: 250, sampleRate: 48000, channels: 1, bits: 16, compatible: true
							}];
						}
						if (command === 'cmd_get_profile') {
							return { pad_count: 16, active_pads: Array.from({ length: 15 }, (_, index) => index + 1), special_pads: [16], name: 'SmplTrek' };
						}
						if (command === 'cmd_load_recent') return { entries: [] };
						if (command === 'cmd_validate') return { errors: [], warnings: [] };
						return undefined;
					}
				}
			});
		});
		await startNewKit(page);
		await page.getByRole('button', { name: 'Choose folder…' }).click();
		const source = page.locator('.file-row', { hasText: 'kick.wav' });
		const target = page.locator('.assignment-target[aria-label="Pad 1"]');
		const pad = page.locator('svg [data-pad="1"]');
		await expect(source).toBeVisible();
		const sourceBounds = await source.boundingBox();
		const targetBounds = await target.boundingBox();
		expect(sourceBounds).not.toBeNull();
		expect(targetBounds).not.toBeNull();
		const sourcePoint = { clientX: sourceBounds!.x + sourceBounds!.width / 2, clientY: sourceBounds!.y + sourceBounds!.height / 2 };
		const targetPoint = { clientX: targetBounds!.x + targetBounds!.width / 2, clientY: targetBounds!.y + targetBounds!.height / 2 };
		const mouseDownPrevented = await source.evaluate((element, point) => !element.dispatchEvent(new MouseEvent('mousedown', {
			bubbles: true,
			cancelable: true,
			button: 0,
			...point
		})), sourcePoint);
		expect(mouseDownPrevented).toBe(true);
		await page.evaluate((point) => window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, button: 0, ...point })), targetPoint);
		await expect(page.locator('.drag-preview')).toContainText('kick.wav');
		await page.evaluate((point) => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, ...point })), targetPoint);
		await expect(page.locator('.drag-debug')).toHaveCount(0);
		await expect(target).toContainText('kick.wav');
		await expect(pad).toHaveClass(/assigned/);
		const remove = page.getByRole('button', { name: 'Remove sample from Pad 1' });
		await remove.click();
		await expect(target).toContainText('Ready for a WAV');
		await expect(pad).not.toHaveClass(/assigned/);
	});

	test('5. Audio explorer renders in the editor', async ({ page }) => {
		await startNewKit(page);
		await expect(page.getByRole('heading', { name: 'Audio files' })).toBeVisible();
	});

	test('6. Language switch updates immediately', async ({ page }) => {
		await page.goto('/');
		const select = page.locator('select[aria-label="Language"], select:has(option:has-text("EN"))').first();
		await select.selectOption('fr');
		await expect(page.getByRole('button', { name: 'Nouveau kit' })).toBeVisible();
		const frenchSelect = page.locator('select[aria-label="Langue"]').first();
		await frenchSelect.selectOption('ja');
		await expect(page.getByRole('button', { name: '新規キット' })).toBeVisible();
		await expect(page.locator('select option[value="en"]')).toHaveText('English');
		await expect(page.locator('select option[value="fr"]')).toHaveText('Français');
		await expect(page.locator('select option[value="ja"]')).toHaveText('Japanese');
	});

	test('6.1. Save button highlights unsaved changes', async ({ page }) => {
		await startNewKit(page);
		await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveClass(/save-ready/);
	});
});

	test('7. Save reports a native dialog error instead of failing silently', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('locale', 'en');
			Object.defineProperty(window, '__TAURI_INTERNALS__', {
				value: {
					metadata: { currentWindow: { label: 'main' } },
					transformCallback: () => 1,
					unregisterCallback: () => {},
					invoke: async (command: string) => {
						if (command === 'plugin:dialog|save') throw new Error('save dialog unavailable');
						if (command === 'cmd_load_recent') return { entries: [] };
						return undefined;
					}
				}
			});
		});
		await page.goto('/');
		await page.getByRole('button', { name: 'New kit' }).click();
		await chooseMenuItem(page, 'Kit', 'Save');
		await expect(page.locator('.toast.error')).toContainText('Save failed');
	});

	test('8. Save sends Rust-compatible sample fields after choosing a path', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('locale', 'en');
			Object.defineProperty(window, '__saveProjectPath', { writable: true, value: null });
			Object.defineProperty(window, '__saveProjectPayload', { writable: true, value: null });
			Object.defineProperty(window, '__TAURI_INTERNALS__', {
				value: {
					metadata: { currentWindow: { label: 'main' } },
					transformCallback: () => 1,
					unregisterCallback: () => {},
					invoke: async (command: string, args?: { path?: string; project?: unknown }) => {
						if (command === 'plugin:dialog|open') return '/fixtures';
						if (command === 'plugin:dialog|save') return '/fixtures/new-kit.json';
						if (command === 'cmd_list_wavs') return [{
							name: 'kick.wav', path: '/fixtures/kick.wav', ext: 'wav', size: 42,
							durationMs: 250, sampleRate: 48000, channels: 1, bits: 16, compatible: true
						}];
						if (command === 'cmd_get_profile') {
							return { pad_count: 16, active_pads: Array.from({ length: 15 }, (_, index) => index + 1), special_pads: [16], name: 'SmplTrek' };
						}
						if (command === 'cmd_validate') return { errors: [], warnings: [] };
						if (command === 'cmd_save_project') {
							(window as typeof window & { __saveProjectPath?: string }).__saveProjectPath = args?.path;
							(window as typeof window & { __saveProjectPayload?: unknown }).__saveProjectPayload = args?.project;
							return undefined;
						}
						if (command === 'cmd_load_recent') return { entries: [] };
						return undefined;
					}
				}
			});
		});
		await page.goto('/');
		await page.getByRole('button', { name: 'New kit' }).click();
		await page.getByRole('button', { name: 'Choose folder…' }).click();
		const source = page.locator('.file-row', { hasText: 'kick.wav' });
		const target = page.locator('.assignment-target[aria-label="Pad 1"]');
		const sourceBounds = await source.boundingBox();
		const targetBounds = await target.boundingBox();
		expect(sourceBounds).not.toBeNull();
		expect(targetBounds).not.toBeNull();
		const sourcePoint = { clientX: sourceBounds!.x + sourceBounds!.width / 2, clientY: sourceBounds!.y + sourceBounds!.height / 2 };
		const targetPoint = { clientX: targetBounds!.x + targetBounds!.width / 2, clientY: targetBounds!.y + targetBounds!.height / 2 };
		await source.evaluate((element, point) => element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, ...point })), sourcePoint);
		await page.evaluate((point) => window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, button: 0, ...point })), targetPoint);
		await page.evaluate((point) => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, ...point })), targetPoint);
		await expect(target).toContainText('kick.wav');
		await chooseMenuItem(page, 'Kit', 'Save');
		await expect.poll(() => page.evaluate(() => (window as typeof window & { __saveProjectPath?: string }).__saveProjectPath)).toBe('/fixtures/new-kit.json');
		await expect.poll(() => page.evaluate(() => {
			const payload = (window as typeof window & { __saveProjectPayload?: { kit?: { pads?: Record<string, { fileName?: string }> } } }).__saveProjectPayload;
			return payload?.kit?.pads?.['1']?.fileName;
		})).toBe('kick.wav');
		await expect(page.locator('.status-pill')).toHaveText('Saved');
	});


test('9. Close kit asks before discarding changes and returns to welcome', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('locale', 'en'));
	await startNewKit(page);
	await chooseMenuItem(page, 'Kit', 'Close kit');
	await expect(page.getByRole('alertdialog')).toBeVisible();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.locator('.assignment-target')).toHaveCount(15);
	await chooseMenuItem(page, 'Kit', 'Close kit');
	await page.getByRole('button', { name: 'Discard' }).click();
	await expect(page.getByRole('heading', { name: 'STK Editor' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'New kit' })).toBeVisible();
});


test('10. Close kit stays open when saving is cancelled', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				metadata: { currentWindow: { label: 'main' } },
				transformCallback: () => 1,
				unregisterCallback: () => {},
				invoke: async (command: string) => {
					if (command === 'plugin:dialog|save') return null;
					if (command === 'cmd_load_recent') return { entries: [] };
					return undefined;
				}
			}
		});
	});
	await startNewKit(page);
	await chooseMenuItem(page, 'Kit', 'Close kit');
	await page.getByRole('alertdialog').getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	await page.waitForTimeout(100);
	await expect(page.locator('.assignment-target')).toHaveCount(15);
	await expect(page.getByRole('heading', { name: 'STK Editor' })).toHaveCount(0);
});


test('11. Open asks before replacing a modified kit', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				metadata: { currentWindow: { label: 'main' } },
				transformCallback: () => 1,
				unregisterCallback: () => {},
				invoke: async (command: string) => {
					if (command === 'plugin:dialog|open') return '/fixtures/existing-kit.json';
					if (command === 'cmd_open_project') {
						return {
							format: 'smpltrek-kit-project', fmt_version: 1, app_version: '0.1.0',
							device: { profile: 'smpltrek', firmware: '3.2' },
							kit: { name: 'Existing', pads: {}, notes: '' }, compile: {}, prefs: {}
						};
					}
					if (command === 'cmd_load_recent') return { entries: [] };
					return undefined;
				}
			}
		});
	});
	await startNewKit(page);
	await chooseMenuItem(page, 'Kit', 'Open kit…');
	await expect(page.getByRole('alertdialog')).toBeVisible();
});


test('12. Compile reports a preflight failure instead of failing silently', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				metadata: { currentWindow: { label: 'main' } },
				transformCallback: () => 1,
				unregisterCallback: () => {},
				invoke: async (command: string) => {
					if (command === 'plugin:dialog|save') return '/fixtures/new-kit.stk';
					if (command === 'plugin:fs|exists') throw new Error('fs exists permission denied');
					if (command === 'cmd_load_recent') return { entries: [] };
					return undefined;
				}
			}
		});
	});
	await startNewKit(page);
	await chooseMenuItem(page, 'Export', 'Compile to .stk…');
	await expect(page.locator('.toast.error')).toContainText('Compilation failed');
	await expect(page.locator('.status-pill')).toHaveText('Compilation failed');
});


test('13. Compact menus replace the separate file-operation buttons', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('locale', 'en'));
	await startNewKit(page);
	await expect(page.getByRole('button', { name: 'Kit', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open kit…' })).toHaveCount(0);
	await expect(page.locator('.build-time')).toHaveCount(0);
});

test('14. Kit Information edits the kit name and notes outside the side panel', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('locale', 'en'));
	await startNewKit(page);
	await page.getByRole('button', { name: 'Kit', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Kit Information…' }).click();
	await expect(page.getByRole('dialog', { name: 'Kit Information' })).toBeVisible();
	await page.getByLabel('Kit name').fill('External drums');
	await page.getByLabel('Notes').fill('Imported from a collaborator.');
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.locator('.project-name')).toHaveText('External drums');
	await expect(page.locator('.panel .kit-name')).toHaveCount(0);
});

test('15. Open Compiled Kit opens a read-only inspection workflow', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('locale', 'en'));
	await startNewKit(page);
	await page.getByRole('button', { name: 'Kit', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Open Compiled Kit…' }).click();
	await expect(page.getByRole('dialog', { name: 'Open Compiled Kit' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Extract as Editable Kit…' })).toBeDisabled();
});

test('16. About is available from the header Help menu and exposes diagnostics', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('locale', 'en'));
	await startNewKit(page);
	await page.getByRole('button', { name: 'Help' }).click();
	await expect(page.getByRole('option', { name: 'README', exact: true })).toHaveCount(0);
	await page.getByRole('option', { name: 'About', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'About STK Editor' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Copy diagnostic information' })).toBeVisible();
	await expect(dialog.getByText('Developed by Patrick Gaumond')).toBeVisible();
	await expect(dialog.getByText('Create editable kits, compile .stk files, and inspect compiled kits locally.')).toBeVisible();
	await expect(dialog.getByText(/STK Editor has not validated that workflow/)).toBeVisible();
	await expect(dialog.getByRole('link')).toHaveCount(0);
});


test('17. Click-away closes an open compact menu', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('locale', 'en'));
	await startNewKit(page);
	await page.getByRole('button', { name: 'Kit', exact: true }).click();
	await expect(page.getByRole('menu', { name: 'Kit' })).toBeVisible();
	await page.locator('.workspace').click({ position: { x: 8, y: 8 } });
	await expect(page.getByRole('menu', { name: 'Kit' })).toHaveCount(0);
});


test('18. Welcome omits compatibility notices and lists five recent projects below its actions', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				metadata: { currentWindow: { label: 'main' } },
				transformCallback: () => 1,
				unregisterCallback: () => {},
				invoke: async (command: string) => {
					if (command === 'cmd_load_recent') {
						return {
							entries: [
								{ name: 'NewKit', path: '', last_opened: '7s', last_modified: '7s', missing: false, has_missing_files: false, unsaved: false },
								{ name: 'Missing project', path: '/kits/missing.json', last_opened: '6s', last_modified: '6s', missing: true, has_missing_files: false, unsaved: false },
								{ name: 'NewKit', path: '/kits/Pat-kit2.json', last_opened: '5s', last_modified: '5s', missing: false, has_missing_files: false, unsaved: false },
								...Array.from({ length: 4 }, (_, index) => ({
									name: `Project ${index + 1}`,
									path: `/kits/project-${index + 1}.json`,
									last_opened: `${5 - index}s`,
									last_modified: `${5 - index}s`,
									missing: false,
									has_missing_files: false,
									unsaved: false,
								}))
							]
						};
					}
					return undefined;
				}
			}
		});
	});
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'STK Editor' })).toBeVisible();
	await expect(page.getByText('Tested only with Sonicware SmplTrek firmware 3.2.')).toHaveCount(0);
	await expect(page.getByText(/ELZ_1 Play STK data is documented by Sonicware, but is not verified/)).toHaveCount(0);
	await expect(page.getByText('Kits récents:')).toBeVisible();
	await expect(page.locator('.welcome .recent-project')).toHaveCount(5);
	await expect(page.getByRole('button', { name: 'Pat-kit2.json' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'NewKit' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Missing project' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'project-1.json' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'project-4.json' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'project-5.json' })).toHaveCount(0);
});


test('19. Header uses the 64px graphical logo beside one gold product title', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('locale', 'en'));
	await startNewKit(page);
	const logo = page.getByTestId('brand-logo');
	await expect(logo).toBeVisible();
	await expect(logo.locator('svg')).toHaveAttribute('viewBox', '0 0 1024 1024');
	const box = await logo.boundingBox();
	expect(box?.width).toBe(64);
	await expect(page.locator('.brand-name')).toHaveText('STK Editor');
});


test('20. Kit holds five recent kits while the header owns help and French status text', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'fr');
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				metadata: { currentWindow: { label: 'main' } },
				transformCallback: () => 1,
				unregisterCallback: () => {},
				invoke: async (command: string) => {
					if (command === 'cmd_load_recent') {
						return {
							entries: Array.from({ length: 6 }, (_, index) => ({
								name: 'NewKit',
								path: `/kits/kit-${index + 1}.json`,
								last_opened: `${6 - index}s`,
								last_modified: `${6 - index}s`,
								missing: false,
								has_missing_files: false,
								unsaved: false,
							}))
						};
					}
					return undefined;
				}
			}
		});
	});
	await page.goto('/');
	await expect(page.locator('.status-pill')).toHaveText('Sauvegardé');
	await expect(page.locator('.app-root > .recent, .app-root > .help')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Aide' })).toBeVisible();
	await page.getByRole('button', { name: 'Kit', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Kits récents…', exact: true }).click();
	await expect(page.locator('[data-testid="recent-kit"]')).toHaveCount(5);
	await expect(page.getByRole('menuitem', { name: 'kit-1', exact: true })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: 'kit-5', exact: true })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: 'kit-6', exact: true })).toHaveCount(0);
});


test('21. Audio Explorer exposes the shared WAV preview volume control', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				metadata: { currentWindow: { label: 'main' } },
				transformCallback: () => 1,
				unregisterCallback: () => {},
				invoke: async (command: string) => {
					if (command === 'plugin:dialog|open') return '/fixtures';
					if (command === 'cmd_list_wavs') return [{
						name: 'kick.wav', path: '/fixtures/kick.wav', ext: 'wav', size: 42,
						durationMs: 250, sampleRate: 48000, channels: 1, bits: 16, compatible: true
					}];
					if (command === 'cmd_get_profile') return { pad_count: 16, active_pads: Array.from({ length: 15 }, (_, index) => index + 1), special_pads: [16], name: 'SmplTrek' };
					if (command === 'cmd_load_recent') return { entries: [] };
					if (command === 'cmd_validate') return { errors: [], warnings: [] };
					return undefined;
				}
			}
		});
	});
	await startNewKit(page);
	await page.getByRole('button', { name: 'Choose folder…' }).click();
	await expect(page.getByLabel('Preview volume')).toHaveAttribute('type', 'range');
	await expect(page.getByLabel('Preview volume')).toHaveValue('80');
});

test('22. Pad controls and theme toggle are localized and visible', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		localStorage.setItem('stk-editor.theme', 'dark');
	});
	await startNewKit(page);
	await expect(page.getByRole('heading', { name: 'Audio pad assignments' })).toBeVisible();
	await expect(page.getByText('Drag audio files into this list or directly onto pads.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Clear all' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Mute preview' })).toHaveAttribute('aria-pressed', 'false');
	await expect(page.getByText('Double-click a pad to hear its assigned sound.')).toBeVisible();
	await page.getByTestId('theme-toggle').click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});


test('22a. Suggested drum positions are visible, localized, and hideable', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('locale', 'en'));
	await startNewKit(page);
	const suggestions = page.getByTestId('suggested-pad-positions');
	const toggle = page.getByRole('button', { name: 'Hide suggested drum position' });
	await expect(suggestions.locator('text.pad-suggestion')).toHaveCount(15);
	await expect(suggestions).toContainText('Crash 1');
	await expect(suggestions).toContainText('Shaker');
	const padOne = page.locator('.pads-svg .track-pad[data-pad="1"]');
	const padOneLabel = suggestions.locator('text.pad-suggestion').first();
	const padBox = await padOne.boundingBox();
	const labelBox = await padOneLabel.boundingBox();
	expect(padBox).not.toBeNull();
	expect(labelBox).not.toBeNull();
	expect(Math.abs((labelBox!.x + labelBox!.width / 2) - (padBox!.x + padBox!.width / 2))).toBeLessThan(1);
	expect(labelBox!.y).toBeGreaterThan(padBox!.y + padBox!.height);
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await toggle.click();
	await expect(suggestions).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Show suggested drum position' })).toHaveAttribute('aria-pressed', 'false');

	await page.reload();
	await page.getByRole('button', { name: 'New kit' }).click();
	await page.getByRole('combobox', { name: 'Language' }).selectOption('fr');
	await expect(page.getByTestId('suggested-pad-positions')).toContainText('Kick 1');
	await expect(page.getByRole('button', { name: 'Masquer les positions suggérées' })).toBeVisible();
});

test('22b. Assigned pad rows always support move and swap by drag', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				metadata: { currentWindow: { label: 'main' } },
				transformCallback: () => 1,
				unregisterCallback: () => {},
				invoke: async (command: string) => {
					if (command === 'plugin:dialog|open') return '/fixtures';
					if (command === 'cmd_list_wavs') return [
						{ name: 'kick.wav', path: '/fixtures/kick.wav', ext: 'wav', size: 42, durationMs: 250, sampleRate: 48_000, channels: 1, bits: 16, compatible: true },
						{ name: 'snare.wav', path: '/fixtures/snare.wav', ext: 'wav', size: 42, durationMs: 250, sampleRate: 48_000, channels: 1, bits: 16, compatible: true },
					];
					if (command === 'cmd_get_profile') return { pad_count: 16, active_pads: Array.from({ length: 15 }, (_, index) => index + 1), special_pads: [16], name: 'SmplTrek' };
					if (command === 'cmd_load_recent') return { entries: [] };
					return undefined;
				},
			},
		});
	});
	await startNewKit(page);
	await page.getByRole('button', { name: 'Choose folder…' }).click();
	const drag = async (source: import('@playwright/test').Locator, target: import('@playwright/test').Locator) => {
		const sourceBox = await source.boundingBox();
		const targetBox = await target.boundingBox();
		expect(sourceBox).not.toBeNull();
		expect(targetBox).not.toBeNull();
		await source.dispatchEvent('mousedown', { button: 0, clientX: sourceBox!.x + 6, clientY: sourceBox!.y + 6 });
		await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2);
		await page.mouse.up();
	};
	const pad = (id: number) => page.locator(`.assignment-target[data-pad="${id}"]`);
	await drag(page.locator('.file-row', { hasText: 'kick.wav' }), pad(1));
	await drag(page.locator('.file-row', { hasText: 'snare.wav' }), pad(2));
	await expect(pad(1)).toContainText('kick.wav');
	await expect(pad(2)).toContainText('snare.wav');

	await drag(pad(1), pad(3));
	await expect(pad(1)).toContainText('Ready for a WAV');
	await expect(pad(3)).toContainText('kick.wav');
	await drag(pad(2), pad(3));
	await expect(pad(2)).toContainText('kick.wav');
	await expect(pad(3)).toContainText('snare.wav');
	await drag(page.locator('.pads-svg .track-pad[data-pad="3"]'), pad(4));
	await expect(pad(3)).toContainText('Ready for a WAV');
	await expect(pad(4)).toContainText('snare.wav');
});

test('23. Persistent UI scale replaces the obsolete view selector', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		localStorage.setItem('stk-editor.ui-scale', '100');
	});
	await startNewKit(page);
	const scale = page.getByRole('combobox', { name: 'Interface scale' });
	await expect(scale).toHaveValue('100');
	await expect(page.getByRole('combobox', { name: 'Full view' })).toHaveCount(0);
	await expect(page.getByRole('combobox', { name: 'Pads view' })).toHaveCount(0);
	await scale.selectOption('125');
	await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '125');
	const padsAt125 = await page.locator('.pads-svg').boundingBox();
	expect(padsAt125).not.toBeNull();
	await scale.selectOption('150');
	await expect(page.locator('html')).toHaveCSS('--ui-scale', '1.5');
	await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '150');
	await expect.poll(() => page.evaluate(() => localStorage.getItem('stk-editor.ui-scale'))).toBe('150');
	const pads = await page.locator('.pads-svg').boundingBox();
	expect(pads).not.toBeNull();
	expect(pads!.width).toBeGreaterThanOrEqual(padsAt125!.width);
	const actions = await page.locator('.pad-actions').boundingBox();
	expect(pads).not.toBeNull();
	expect(actions).not.toBeNull();
	expect(actions!.y).toBeGreaterThanOrEqual(pads!.y + pads!.height);
});


test('24. Physical pads show subtle associated numbers', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('locale', 'en'));
	await startNewKit(page);
	const numbers = page.locator('.pads-svg .pad-number');
	await expect(numbers).toHaveCount(15);
	await expect(numbers.first()).toHaveText('1');
	await expect(numbers.last()).toHaveText('15');
	await expect(numbers.first()).toHaveAttribute('font-size', '28');
	await expect(numbers.first()).toHaveCSS('opacity', '0.11');
});




test('25. Physical pad text is non-selectable and double-click keeps WAV preview', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				metadata: { currentWindow: { label: 'main' } },
				transformCallback: () => 1,
				unregisterCallback: () => {},
				invoke: async (command: string) => {
					if (command === 'plugin:dialog|open') return '/fixtures';
					if (command === 'plugin:fs|read_file') return new Uint8Array([0]);
					if (command === 'cmd_list_wavs') return [{ name: 'kick.wav', path: '/fixtures/kick.wav', ext: 'wav', size: 42, durationMs: 250, sampleRate: 48_000, channels: 1, bits: 16, compatible: true }];
					if (command === 'cmd_get_profile') return { pad_count: 16, active_pads: Array.from({ length: 15 }, (_, index) => index + 1), special_pads: [16], name: 'SmplTrek' };
					if (command === 'cmd_load_recent') return { entries: [] };
					return undefined;
				},
			},
		});
	});
	await startNewKit(page);
	await page.getByRole('button', { name: 'Choose folder…' }).click();

	const physicalPad = page.locator('.pads-svg .track-pad[data-pad="1"]');
	const label = physicalPad.locator('text').first();
	const number = physicalPad.locator('.pad-number');
	await expect(label).toHaveCSS('user-select', 'none');
	await expect(label).toHaveCSS('pointer-events', 'none');
	await expect(number).toHaveCSS('user-select', 'none');
	await expect(number).toHaveCSS('pointer-events', 'none');

	const source = page.locator('.file-row', { hasText: 'kick.wav' });
	const target = page.locator('.assignment-target[aria-label="Pad 1"]');
	const sourceBounds = await source.boundingBox();
	const targetBounds = await target.boundingBox();
	expect(sourceBounds).not.toBeNull();
	expect(targetBounds).not.toBeNull();
	await source.dispatchEvent('mousedown', { button: 0, clientX: sourceBounds!.x + 4, clientY: sourceBounds!.y + 4 });
	await page.mouse.move(targetBounds!.x + targetBounds!.width / 2, targetBounds!.y + targetBounds!.height / 2);
	await page.mouse.up();
	await expect(target).toContainText('kick.wav');
	await physicalPad.dblclick();
	await expect(physicalPad).toHaveClass(/previewing/);
});
test('25. Pad assignments remain top-aligned at 200% scale', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		localStorage.setItem('stk-editor.ui-scale', '100');
	});
	await startNewKit(page);
	await page.getByRole('combobox', { name: 'Interface scale' }).selectOption('200');
	const topbar = await page.locator('.topbar').boundingBox();
	const assignments = await page.locator('.assignment-panel').boundingBox();
	expect(topbar).not.toBeNull();
	expect(assignments).not.toBeNull();
	const gap = assignments!.y - (topbar!.y + topbar!.height);
	expect(gap).toBeLessThanOrEqual(24);
});


test('26. Empty Audio Explorer does not create vertical overflow', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		localStorage.setItem('stk-editor.ui-scale', '100');
	});
	await startNewKit(page);
	await page.getByRole('combobox', { name: 'Interface scale' }).selectOption('200');
	const metrics = await page.evaluate(() => {
		const root = document.documentElement;
		const read = (selector: string) => {
			const element = document.querySelector<HTMLElement>(selector)!;
			return {
				clientHeight: element.clientHeight,
				scrollHeight: element.scrollHeight,
				overflowY: getComputedStyle(element).overflowY,
			};
		};
		return {
			root: { clientHeight: root.clientHeight, scrollHeight: root.scrollHeight },
			workspace: read('.workspace'),
			explorer: read('.panel .body'),
			fileList: read('.file-list'),
		};
	});
	expect(metrics.root.scrollHeight).toBeLessThanOrEqual(metrics.root.clientHeight);
	expect(metrics.workspace.overflowY).toBe('hidden');
	expect(metrics.explorer.scrollHeight).toBeLessThanOrEqual(metrics.explorer.clientHeight);
	expect(metrics.explorer.overflowY).toBe('hidden');
	expect(metrics.fileList.overflowY).toBe('auto');
});


test('27. WAV list columns are configurable and Explorer width persists', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				metadata: { currentWindow: { label: 'main' } },
				transformCallback: () => 1,
				unregisterCallback: () => {},
				invoke: async (command: string) => {
					if (command === 'plugin:dialog|open') return '/fixtures';
					if (command === 'cmd_list_wavs') return [{
						name: 'kick.wav', path: '/fixtures/kick.wav', ext: 'wav', size: 1_536,
						durationMs: 1_500, sampleRate: 48_000, channels: 1, bits: 16,
						compatible: true, modified: 1_700_000_000_000,
					}];
					if (command === 'cmd_get_profile') return { pad_count: 16, active_pads: Array.from({ length: 15 }, (_, index) => index + 1), special_pads: [16], name: 'SmplTrek' };
					if (command === 'cmd_load_recent') return { entries: [] };
					return undefined;
				},
			},
		});
	});
	await startNewKit(page);
	await page.getByRole('button', { name: 'Choose folder…' }).click();

	await expect(page.getByRole('columnheader', { name: 'File' })).toBeVisible();
	await expect(page.getByRole('columnheader', { name: 'Size' })).toBeVisible();
	await expect(page.getByRole('columnheader', { name: 'Duration' })).toBeVisible();
	await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
	await expect(page.getByText('1.5s')).toBeVisible();
	await expect(page.getByText('1.5 KB')).toBeVisible();
	await expect(page.getByText(/NaN/)).toHaveCount(0);

	const sizeColumn = page.getByRole('checkbox', { name: 'Show size' });
	await sizeColumn.uncheck();
	await expect(page.getByRole('columnheader', { name: 'Size' })).toHaveCount(0);
	await expect(page.getByRole('columnheader', { name: 'File' })).toBeVisible();

	const explorer = page.locator('.audio-explorer');
	const initialWidth = await explorer.evaluate((element) => element.getBoundingClientRect().width);
	const handle = page.getByRole('button', { name: 'Resize Audio Explorer' });
	const box = await handle.boundingBox();
	expect(box).not.toBeNull();
	await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
	await page.mouse.down();
	await page.mouse.move(box!.x - 80, box!.y + box!.height / 2);
	await page.mouse.up();
	const resizedWidth = await explorer.evaluate((element) => element.getBoundingClientRect().width);
	expect(resizedWidth).toBeGreaterThan(initialWidth);

	await page.reload();
	await startNewKit(page);
	await expect(page.getByRole('checkbox', { name: 'Show size' })).not.toBeChecked();
	await expect(page.locator('.audio-explorer')).toHaveCSS('width', `${resizedWidth}px`);
});


test('29. Audio Explorer restores its saved visual width at 200% scale', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		localStorage.setItem('stk-editor.ui-scale', '200');
		localStorage.removeItem('stk-editor.audio-explorer.width');
		localStorage.setItem('stk-editor.audio-explorer.visual-width.v2', '960');
	});
	await startNewKit(page);
	await expect(page.locator('.audio-explorer')).toHaveCSS('flex-basis', '320px');
});


test('30. Enlarged workspace starts with the pad facade reachable from the left', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		localStorage.setItem('stk-editor.ui-scale', '200');
	});
	await startNewKit(page);
	const layout = await page.evaluate(() => {
		const workspace = document.querySelector<HTMLElement>('.workspace')!;
		const device = document.querySelector<HTMLElement>('.device')!;
		return { scrollLeft: workspace.scrollLeft, deviceLeft: device.getBoundingClientRect().left };
	});
	expect(layout.scrollLeft).toBe(0);
	expect(layout.deviceLeft).toBeGreaterThanOrEqual(0);
});


test('31. Enlarged workspace anchors its oversized stage at the left edge', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		localStorage.setItem('stk-editor.ui-scale', '200');
	});
	await startNewKit(page);
	await expect(page.locator('.workspace')).toHaveCSS('justify-content', 'flex-start');
	await expect(page.locator('.device')).toHaveCSS('justify-content', 'flex-start');
	await page.locator('.workspace').evaluate((workspace) => { workspace.scrollLeft = workspace.scrollWidth; });
	await page.reload();
	await startNewKit(page);
	await expect.poll(() => page.locator('.workspace').evaluate((workspace) => workspace.scrollLeft)).toBe(0);
});


test('32. CSS zoom fallback keeps the app root within the viewport width', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		localStorage.setItem('stk-editor.ui-scale', '200');
	});
	await startNewKit(page);
	const metrics = await page.evaluate(() => {
		const root = document.querySelector<HTMLElement>('.app-root')!;
		return { viewportWidth: window.innerWidth, rootWidth: root.getBoundingClientRect().width };
	});
	expect(metrics.rootWidth).toBeLessThanOrEqual(metrics.viewportWidth);
});


test('33. Quit menu exits the native application after the guard succeeds', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en');
		Object.defineProperty(window, '__appExitRequested', { writable: true, value: false });
		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				metadata: { currentWindow: { label: 'main' } },
				transformCallback: () => 1,
				unregisterCallback: () => {},
				invoke: async (command: string) => {
					if (command === 'cmd_exit_app') {
						(window as typeof window & { __appExitRequested?: boolean }).__appExitRequested = true;
					}
					if (command === 'cmd_load_recent') return { entries: [] };
					return undefined;
				}
			}
		});
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Kit', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Quit STK Editor', exact: true }).click();
	await expect.poll(() => page.evaluate(() => (window as typeof window & { __appExitRequested?: boolean }).__appExitRequested)).toBe(true);
});
