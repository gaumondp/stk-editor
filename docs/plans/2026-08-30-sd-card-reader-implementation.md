# SD Card Reader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a read-only SmplTrek SD-card browser, launched from a horizontal pad-action button, that validates `/SmplTrek` and shows projects, preset counts, and WAV files.

**Architecture:** A small Rust `sd_card` module receives the picker path, resolves either a volume root or `SmplTrek` itself, and returns a serde report. `App.svelte` owns the modal state and native directory selection; `DeviceView.svelte` only emits the read-card action. A dedicated dialog renders the report using existing modal tokens and focus trapping.

**Tech Stack:** Svelte 5 + TypeScript, Tauri 2 dialog plugin, Rust `std::fs`/`walkdir`, Vitest, Playwright.

**Native API verification:** The official Tauri dialog plugin documents `open({ directory: true })` as returning one selected path string or `null`; the app already registers `tauri_plugin_dialog::init()` and has `dialog:allow-open` capability.

---

### Task 1: Test the SD-card scanner contract

**Files:**
- Create: `src-tauri/src/sd_card.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/sd_card.rs`

**Step 1: Write failing scanner tests**

Create temporary folders that cover:

```rust
#[test]
fn reads_a_card_volume_and_summarizes_projects_presets_and_wavs() {
    let card = tempfile::tempdir().unwrap();
    let root = card.path().join("SmplTrek");
    std::fs::create_dir_all(root.join("Project/Getting Started")).unwrap();
    std::fs::create_dir_all(root.join("Preset/Audio/Drum")).unwrap();
    std::fs::create_dir_all(root.join("Preset/Audio/Inst")).unwrap();
    std::fs::create_dir_all(root.join("Preset/Kit")).unwrap();
    std::fs::create_dir_all(root.join("Pool/Audio/Drum")).unwrap();
    std::fs::write(root.join("Pool/Audio/Drum/kick.wav"), []).unwrap();

    let report = inspect_sd_card(card.path().to_str().unwrap()).unwrap();
    assert!(report.valid);
    assert_eq!(report.projects, vec!["Getting Started"]);
    assert_eq!(report.presets.audio_drum, 0);
    assert_eq!(report.audio_files[0].relative_path, "Pool/Audio/Drum/kick.wav");
}
```

Also cover a selected `SmplTrek` folder, a path with no `SmplTrek` directory, and an incomplete layout. The invalid root must return a report with `valid == false`, not expose files outside the selected folder, and not panic.

**Step 2: Run the focused test to verify it fails**

Run:

```bash
PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml sd_card
```

Expected: FAIL because the module and scanner do not exist.

**Step 3: Implement the minimal read-only scanner**

In `src-tauri/src/sd_card.rs`, define camelCase serde structures:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SdCardReport {
    pub selected_path: String,
    pub smpltrek_path: Option<String>,
    pub valid: bool,
    pub missing_directories: Vec<String>,
    pub projects: Vec<String>,
    pub presets: SdPresetCounts,
    pub audio_files: Vec<SdAudioFile>,
}
```

Implement `inspect_sd_card(selected_path: &str) -> Result<SdCardReport, String>` using only `std::fs` and the existing `walkdir` dependency:

- canonicalize the selected path when possible;
- use it when its final component is `SmplTrek`, otherwise use `<selected>/SmplTrek`;
- reject a non-directory selected path with an error;
- report missing `Pool`, `Preset`, and `Project` directories without writing anything;
- list immediate directories under `Project`, sorted case-insensitively;
- count `.stk` files in `Preset/Audio/Drum`, `.wav` files in `Preset/Audio/Inst`, and `.stk` files in `Preset/Kit`;
- recursively list `.wav` files below `SmplTrek` as sorted relative paths, file sizes, and source groups.

Export the module and its public types from `src-tauri/src/lib.rs`. Do not add filesystem plugin permissions: this command reads through Rust after an explicit native picker action.

**Step 4: Run the focused test to verify it passes**

Run the command from Step 2.

Expected: all `sd_card` tests PASS.

**Step 5: Commit only when explicitly requested**

Do not commit autonomously. If requested, stage only `src-tauri/src/sd_card.rs` and `src-tauri/src/lib.rs` plus their tests.

### Task 2: Expose the typed Tauri command

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src/lib/commands.ts`
- Test: `src/lib/commands.test.ts`

**Step 1: Write a failing TypeScript wrapper test**

Mock `invoke` and assert that calling `api.inspectSdCard('/Volumes/NO NAME')` invokes exactly:

```ts
invoke('cmd_inspect_sd_card', { selectedPath: '/Volumes/NO NAME' })
```

and returns the typed `SdCardReport` unchanged.

**Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm test src/lib/commands.test.ts
```

Expected: FAIL because the wrapper is absent.

**Step 3: Register the native command and wrapper**

In `src-tauri/src/main.rs`, import `SdCardReport`, add `cmd_inspect_sd_card` to `generate_handler!`, and delegate to `lib::sd_card::inspect_sd_card(&selected_path)`.

In `src/lib/commands.ts`, add `SdPresetCounts`, `SdAudioFile`, and `SdCardReport` interfaces matching the Rust camelCase wire format. Add:

```ts
inspectSdCard: (selectedPath: string) => invoke<SdCardReport>('cmd_inspect_sd_card', { selectedPath })
```

to the existing `api` object.

**Step 4: Run focused tests**

Run:

```bash
pnpm test src/lib/commands.test.ts
PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml sd_card
```

Expected: PASS.

**Step 5: Commit only when explicitly requested**

Do not commit autonomously.

### Task 3: Add the dialog and translated strings

**Files:**
- Create: `src/components/SdCardReaderDialog.svelte`
- Modify: `src/lib/i18n.ts`
- Modify: `src/lib/i18n.test.ts`

**Step 1: Write failing translation coverage**

Extend `src/lib/i18n.test.ts` so English, French, and Japanese resolve every new `sd_reader.*` key without returning its raw key. Include title, choose-card action, invalid-card result, incomplete-card result, projects, presets, audio files, and close labels.

**Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm test src/lib/i18n.test.ts
```

Expected: FAIL for absent SD-reader keys.

**Step 3: Implement the accessible report dialog**

Create `SdCardReaderDialog.svelte` using the existing `focusTrap` action and modal structure. Its public props are `open`, `report`, `onClose`, and `onChooseAnother`.

When open, render:

- a labelled `role="dialog"`, `aria-modal="true"`, title, selected path, and Close control;
- success, incomplete, or invalid state without claiming native-media detection;
- project count plus project names;
- three preset-count rows;
- a scrollable, searchable table of every discovered audio file, showing its relative path and size;
- a **Choose another card…** action.

Use only the project’s established `--bg-*`, `--fg`, `--line`, `--ok`, `--warn`, and `--err` tokens. Keep the dialog responsive and preserve `max-height` scrolling used by `StkInspectDialog.svelte`.

**Step 4: Add all translations and run focused tests**

Add matching `sd_reader.*` dictionaries in English, French, and Japanese. Run the Step 2 command.

Expected: PASS.

**Step 5: Commit only when explicitly requested**

Do not commit autonomously.

### Task 4: Connect the chosen pad-button design to the dialog

**Files:**
- Modify: `src/components/DeviceView.svelte`
- Modify: `src/App.svelte`
- Modify: `tests/e2e/critical.spec.ts`

**Step 1: Write a failing browser test**

Mock `plugin:dialog|open` as `/Volumes/NO NAME` and `cmd_inspect_sd_card` as a valid report. Assert that, after opening a new kit:

```ts
await expect(page.getByRole('button', { name: 'Read SD card' })).toBeVisible();
await page.getByRole('button', { name: 'Read SD card' }).click();
await expect(page.getByRole('dialog', { name: 'SD Card Reader' })).toBeVisible();
await expect(page.getByText('Getting Started')).toBeVisible();
await expect(page.getByText('Pool/Audio/Drum/kick.wav')).toBeVisible();
```

Also assert that the button has a dedicated `sd-reader-action` class whose desktop CSS provides `margin-top: 24px`, and that the invalid report offers another selection.

**Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm exec playwright test tests/e2e/critical.spec.ts --grep "SD Card Reader"
```

Expected: FAIL because the action and dialog do not exist.

**Step 3: Implement the approved interaction**

In `DeviceView.svelte`, accept an `onReadSdCard` callback prop and add a full-width button directly after the suggestions control. Include an inline SVG SD-card icon marked `aria-hidden="true"`; its label comes from `tr('sd_reader.open')`. Add only these design-specific rules:

```css
.pad-action.sd-reader-action { margin-top: 24px; }
.sd-reader-icon { width: 16px; height: 16px; }
```

At larger UI scales and the mobile breakpoint, retain the 24 px visual separation even when actions flow horizontally.

In `App.svelte`, own `showSdCardReader` and the report. The callback must:

1. call the existing `open({ directory: true, multiple: false })` plugin API;
2. return without state changes on `null`;
3. call `api.inspectSdCard(selectedPath)`;
4. open the dialog with the report;
5. turn invocation failures into the existing error toast.

Pass the same callback to `onChooseAnother` in `SdCardReaderDialog`.

**Step 4: Run the focused browser test**

Run the Step 2 command.

Expected: PASS.

**Step 5: Commit only when explicitly requested**

Do not commit autonomously.

### Task 5: Validate, document, and visually inspect

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Step 1: Update English-facing release documentation**

Add a concise English README feature bullet explaining local, read-only SmplTrek SD-card inspection. Add an Unreleased CHANGELOG entry. Do not add French prose to the README.

**Step 2: Run complete automated validation**

Run:

```bash
pnpm check
pnpm test
pnpm exec playwright test tests/e2e/critical.spec.ts
PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all relevant suites PASS, with only pre-existing warnings if any.

**Step 3: Build and inspect the macOS application**

Run:

```bash
PATH="$HOME/.cargo/bin:$PATH" pnpm tauri build --bundles app
open -n '/Users/pgaumond/PhpstormProjects/stk-forge/src-tauri/target/release/bundle/macos/STK Forge.app'
```

Capture a screenshot of the button and the populated overlay. Review it against the approved mockup A and run a separate new-user usability review. Ask the user to manually select a real card or directory before claiming native-card validation.

**Step 4: Commit only when explicitly requested**

Do not commit autonomously. Before any requested commit, show the absolute-path unified diff, run `git diff --check`, and stage only the approved files.
