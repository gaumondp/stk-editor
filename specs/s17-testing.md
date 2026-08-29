# S17 — Testing plan

Status: todo (unit tests exist in Rust; frontend tests + E2E + fixtures pending).
Scope: §19, §20, §22, §23.

## Scope

Test strategy: unit (Rust + TS), integration (Tauri commands), E2E (Playwright),
device validation (real SmplTrek 3.2), regression fixtures.

## Test pyramid
```
           E2E (Playwright)           ← 10 critical paths
      ┌───────────────────────┐
      │  Integration (Tauri)  │  ← 30 command tests
      ├───────────────────────┤
      │  Unit (Rust + TS)     │  ← 100+ pure fn tests
      └───────────────────────┘
```

## 1. Rust unit tests (`cargo test`)

### Profile (S01)
- `SmplTrek32` constants match spec (pad_count=16, active=1..15, special=16).
- `validate_kit_name`: empty, length, ASCII, separators → correct errors.
- `validate_params`: bounds for volume/pan/pitch/fx_send.
- `known_profile`: valid → profile; unknown id/fw → typed errors.

### WAV (S04)
- `parse_wav`: valid RIFF/WAVE → parsed; truncated/corrupt → error.
- `decode`: each SampleKind (PCM_8,16,24,32, FLOAT_32,64) → i16.
- `mix`/`downmix`: channel conversions (mono↔stereo, N→1, N→2).
- `resample`: 44.1k→48k, 96k→48k, 22.05k→48k (linear interp accuracy).
- `normalize`: end-to-end on fixture WAVs → 48k/16-bit output.
- `build_wav`: round-trip `parse_wav(build_wav(pcm))` → same pcm.

### Compile (S03)
- `validate`: valid project → ok; invalid name/params/missing → errors.
- `compile`: valid project → .STK bytes; verify header magic, KTDT size,
  entry count, ISDT count, WAV count = pad_count.
- `resolve_source`: assigned pad with path → resolves; missing → error.
- `synth_silence`: mono/stereo → correct frame count (48000).

### Export (S09)
- `export_sd`: hardware profile → only Kit folder; full → all folders.
- WAV copy: only assigned active pads; skip existing.
- README content includes kit name, version, pads filled.

### Missing files (S08)
- `resolve_missing`: file in project dir → relinked.
- `find_missing`: report items with resolved=true/false.
- `relink_sample`: updates resolved_path+meta+sha256, keeps original_path.

### Git (S12)
- `redact_url`: strips user:pass@, ?token=, ?access_token=.
- `detect_kind`: github/grok/other.
- `status` parsing: modified/untracked/ahead/behind/conflicts.

### Recent (S10)
- `touch_recent`: dedupe, MRU order, cap 12, canonicalize path.
- `check_missing_files`: detects unresolved samples.

## 2. TypeScript unit tests (`pnpm test` / vitest)

### i18n (S11)
- `tr(key)` returns string for all keys in en.ftl + fr.ftl.
- `setLocale` switches language, persists.
- Interpolation works: `tr('key', { var: 'value' })`.

### Stores (S05, S13)
- `markDirty` / `setSaved` toggle dirty + status pill.
- `commit` pushes undo, clears redo, marks dirty.
- `undo`/`redo` restore snapshots, cap 100.
- `guardUnsaved`: dirty=false → resolves true; dirty=true → shows dialog.

### Commands (S02–S12)
- Type guards: `Project` / `Sample` / `AudioFile` round-trip serialize.
- Mock Tauri `invoke` → test command wrappers.

## 3. Integration tests (Tauri commands)

Run in headless Tauri (or mocked backend):
- `open_project` + `save_project` round-trip (temp dir).
- `compile` → valid .STK file (verify with Rust `compile::validate`).
- `export` hardware/full → correct folder structure.
- `list_wavs` + `audio_meta` on fixture dir.
- `find_missing` + `relink` flow.
- `git_*` commands against temp git repo.
- `load_recent` / `touch_recent` / `clear_recent` / `remove_recent`.

## 4. E2E tests (Playwright)

### Critical paths (10)
1. **New Kit → Save → Open** — round-trip JSON identical.
2. **Drag WAV from Explorer → Pad 1** — assigned, prelisten works.
3. **Replace Pad 1** — undo restores previous.
4. **Cmd/Ctrl-Click Pad 1** — removed, file untouched.
5. **Compile → .STK** — loads on device (manual verify).
6. **Export Hardware → SD** — only Kit/.stk created.
7. **Export Full → SD** — Kit + WAVs + JSON + README.
8. **Missing file → Auto-find → Relink** — compile unblocked.
9. **Git init → Commit → Push** — status updates.
10. **Language switch FR/EN** — all UI updates, persists.

### Run: `pnpm test:e2e` (headed for device, headless for CI).

## 5. Device validation (manual, per release)

### Fixtures (commit to `tests/fixtures/`)
- 3 real `.STK` files from SmplTrek 3.2 (golden masters).
- 20 WAV files covering all SampleKind + channel combos.
- 5 project JSONs: valid, missing files, invalid name, max pads, special pad.

### Validation steps
1. Load each golden .STK → parse (if we add parser) or compile project →
   compare bytes (allow timestamp variance).
2. Compile fixture projects → .STK → load on physical SmplTrek 3.2.
3. Verify all 15 pads play correct samples, params applied.
4. Export Full → SD → load on device → kits appear, samples play.

## 6. Regression fixtures (S19)

| Fixture | Purpose |
|---|---|
| `valid_project.json` | Round-trip save/load |
| `missing_samples.json` | S08 auto-relink |
| `invalid_kit_name.json` | S03 validation |
| `max_pads.json` | 15 active + 1 special |
| `golden_kit_1.stk` | Device byte compare |
| `golden_kit_2.stk` | Device byte compare |
| `golden_kit_3.stk` | Device byte compare |
| `wav_pcm8_mono.wav` | S04 normalize |
| `wav_pcm16_stereo.wav` | S04 normalize |
| `wav_pcm24_mono.wav` | S04 normalize |
| `wav_pcm32_stereo.wav` | S04 normalize |
| `wav_float32_mono.wav` | S04 normalize |
| `wav_float64_stereo.wav` | S04 normalize |
| `wav_corrupt.wav` | Error handling |

## CI Gates (must pass before merge)
- `cargo test` (all Rust units + integration)
- `pnpm test` (TS units)
- `pnpm test:e2e` (Playwright headless)
- `cargo audit` + `pnpm audit`
- `svelte-check` (typecheck)
- `eslint` (lint)
- `cargo fmt --check` / `prettier --check`

## Coverage targets
- Rust: ≥ 80% lines (focus: compile, wav, profile, git).
- TS: ≥ 70% lines (focus: stores, i18n, commands).
- E2E: 100% critical paths.

## Gaps / TODOs
- [ ] Set up vitest + Playwright in repo.
- [ ] Add fixture WAVs + .STKs to `tests/fixtures/` (git-lfs for .STK).
- [ ] Write Rust unit tests for all modules (currently ~40% coverage).
- [ ] Write TS unit tests for stores + i18n.
- [ ] Write Playwright E2E for 10 critical paths.
- [ ] Device validation script (automated MIDI/USB? manual for V1).
- [ ] Perf benchmarks: compile 15 pads < 2s, export < 5s, list 1k WAVs < 200ms.

## Acceptance
- `cargo test` + `pnpm test` + `pnpm test:e2e` all green in CI.
- Golden .STK byte comparison passes (allowing timestamp fields).
- Physical SmplTrek 3.2 loads and plays all test kits correctly.
- No flaky tests (re-run 3x on CI).
- Coverage reports uploaded (codecov / coveralls).