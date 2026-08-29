# Release Process — SmplTrek Kit Builder

This document describes how to cut a signed, notarized release (see `specs/s16-packaging.md`).

## Pre-release checklist

```bash
cargo test --manifest-path src-tauri/Cargo.toml   # 14/14 Rust unit
pnpm check                                        # svelte-check 0 error
pnpm build                                        # vite 195kB
cargo audit && pnpm audit                         # no high severity
```

Manual QA on macOS 13+ and Windows 10/11 (clean VM):

1. New Kit → drag 3 WAVs → compile → `.STK` loads on SmplTrek fw 3.2
2. Export *Hardware* → verify `SmplTrek/Pool/Kit/*.stk` only
3. Export *Full* → verify `SmplTrek/Pool/Audio/Drum/*.wav` + `projects/*.json` + `README.txt` + no overwrite of existing WAV
4. Missing file: move a WAV → reopen → red path → *Find missing* → relink
5. Undo/redo, `Cmd+Z`, Delete, Space prelisten, `F1` shortcuts

## Versioning

- Source of truth: `package.json` `version` == `src-tauri/Cargo.toml` `version` == `src-tauri/tauri.conf.json` `version` (injected via `vite.config.ts:import.meta.env.APP_VERSION`)
- Tag format: `vMAJOR.MINOR.PATCH` (semver)
- Changelog: `CHANGELOG.md` (generated from conventional commits, `pnpm changelog` when added)

## Tag & push

```bash
# bump version in package.json + Cargo.toml + tauri.conf.json
pnpm version patch|minor|major   # or edit manually
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore(release): v0.1.1"
git tag v0.1.1
git push origin main --tags
```

## CI — `.github/workflows/release.yml`

On tag `v*`:

- Matrix `macos-latest` (universal `aarch64+x86_64` via `lipo`) + `windows-latest`
- `pnpm install --frozen-lockfile` → `cargo check` → `cargo test` → `pnpm tauri:build`
- **macOS signing** (requires secrets):
  - `APPLE_CERTIFICATE` (base64 `.p12`) + `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_SIGNING_IDENTITY` (`Developer ID Application: …`)
  - `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` for `notarytool submit --wait` + `stapler staple`
  - `TAURI_SIGNING_PRIVATE_KEY` / `PASSWORD` for updater (V1.1)
- **Windows signing**:
  - `WIN_CERT_THUMBPRINT` (EV cert SHA1) → `signtool sign /tr http://timestamp.digicert.com /td sha256`
- `SHA256SUMS` generated, artifacts uploaded, draft GitHub Release created (auto notes)

Secrets are in GitHub Environment `release` (required reviewers: 1).

## Verify artifacts

```bash
# macOS
codesign -vvv --deep --strict SmplTrek\ Kit\ Builder.app
spctl -a -v SmplTrek\ Kit\ Builder.app
xcrun stapler validate SmplTrek_Kit_Builder_*.dmg

# Windows
signtool verify /pa SmplTrek_Kit_Builder_*.msi
```

Gatekeeper / SmartScreen must pass without warnings.

## Publish

1. Open draft release on GitHub → edit notes → attach `SHA256SUMS`
2. `Publish release` (or keep draft for internal QA)
3. Announce + attach `README.txt` note from SD export

## Hotfix

Branch from tag: `git checkout -b hotfix/v0.1.2 v0.1.1` → fix → bump patch → tag `v0.1.2`.

## Entitlements

`src-tauri/entitlements.plist` (hardened runtime, `files.user-selected.read-write`, `device.usb`). Update only when Tauri or macOS requirements change — test on clean macOS VM after change.
