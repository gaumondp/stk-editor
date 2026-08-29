# S16 — Packaging, signing, release

Status: todo (Tauri config exists; signing + CI release pipeline not done).
Scope: §16, §17.

## Scope

Produce signed, notarized distributables for macOS (DMG) and Windows (MSI/
NSIS). Automated release on tag push.

## Targets
| Platform | Format | Arch | Signing |
|---|---|---|---|
| macOS | DMG (universal) | arm64 + x64 | Developer ID Application + Notarization |
| Windows | MSI (per-user) | x64 | Authenticode (EV cert) |

## Tauri config (tauri.conf.json)
```json
{
  "bundle": {
    "active": true,
    "targets": ["dmg", "msi"],
    "identifier": "com.stkeditor.desktop",
    "icon": ["icons/icon.png"],
    "macOS": {
      "signingIdentity": "Developer ID Application: ...",
      "providerShortName": "TEAM_ID",
      "entitlements": "entitlements.plist",
      "exceptionDomain": "",
      "minimumSystemVersion": "13.0"
    },
    "windows": {
      "certificateThumbprint": "ENV:WIN_CERT_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

## Entitlements (macOS)
```xml
<!-- entitlements.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.files.user-selected.read-write</key><true/>
  <key>com.apple.security.files.downloads.read-write</key><true/>
  <key>com.apple.security.device.usb</key><true/>  <!-- for SD card access -->
</dict>
</plist>
```

## CI Pipeline (GitHub Actions)
### Build matrix
- `macos-latest` (ARM64 runner) → builds universal via `cargo build --target aarch64-apple-darwin --target x86_64-apple-darwin` + `lipo`.
- `windows-latest` → builds MSI.

### Steps
1. Checkout + setup Rust (stable) + Node (LTS) + pnpm.
2. `pnpm install --frozen-lockfile`.
3. `pnpm tauri build` (runs Vite + Cargo).
4. **Signing** (macOS):
   - `codesign --deep --force --options runtime --sign "$SIGNING_IDENTITY" --entitlements entitlements.plist App.app`
   - `xcrun notarytool submit App.dmg --keychain-profile "NOTARY_PROFILE" --wait`
   - `xcrun stapler staple App.dmg`
5. **Signing** (Windows):
   - `signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /sha1 $THUMBPRINT App.msi`
6. Upload artifacts (DMG, MSI) to GitHub Release (draft).
7. Generate `SHA256SUMS` for all artifacts.
8. On tag `v*`: publish release (auto or manual approval).

## Secrets (GitHub Environments → `release`)
- `MAC_SIGNING_IDENTITY` (base64 .p12 + password).
- `MAC_NOTARY_PROFILE` (keychain profile name).
- `WIN_CERT_THUMBPRINT` (cert hash).
- `WIN_CERT_PASSWORD` (if PFX).

## Versioning
- Source of truth: `Cargo.toml` `version` = `package.json` `version`.
- `tauri.conf.json` reads from `package.json` at build.
- Tag format: `v{major}.{minor}.{patch}` (semver).
- Changelog: `CHANGELOG.md` generated from conventional commits (V1.1).

## Pre-release checklist
- [ ] `cargo test` + `pnpm test` + `svelte-check` green.
- [ ] `cargo audit` + `pnpm audit` clean.
- [ ] Manual QA on both OSes: new kit → assign → compile → export → load on device.
- [ ] Codesign verify: `codesign -vvv --deep --strict App.app` / `signtool verify /pa App.msi`.
- [ ] Notarization check: `spctl -a -v App.app` (macOS).
- [ ] VirusTotal scan of artifacts (optional).
- [ ] README / CHANGELOG updated.

## Auto-update (V1.1)
- Tauri Updater + GitHub Releases endpoint.
- Signature verification (minisign / ed25519).
- Background check + user prompt.

## Gaps / TODOs
- [ ] Create `entitlements.plist` + add to repo.
- [ ] Configure GitHub Actions workflow (`.github/workflows/release.yml`).
- [ ] Obtain Apple Developer ID + notarization profile.
- [ ] Obtain Windows EV code signing cert.
- [ ] Test universal macOS build on CI (ARM + x64).
- [ ] Test MSI install/upgrade/uninstall on clean Windows VM.
- [ ] Automate `CHANGELOG.md` generation.
- [ ] Document release process in `RELEASE.md`.

## Acceptance
- `git tag v0.1.0 && git push origin v0.1.0` → CI builds + signs + creates draft release.
- DMG installs on macOS 13+ (ARM + Intel), launches, runs all features.
- MSI installs on Windows 10/11, launches, runs all features.
- Both pass Gatekeeper / SmartScreen without warnings.
- Artifacts have matching SHA256 in release notes.
- Version in About dialog matches tag.