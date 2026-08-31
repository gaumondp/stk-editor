# Release Process

The product is **STK Forge**. The Rust crate, the Windows executable name and the
JSON schema name `smpltrek-kit-project` intentionally keep the legacy
`smpltrek-kit-builder` identifier for backward compatibility, so those names are
correct below and are not a stale product name.

Releases are built by GitHub Actions, not by hand. See
[`.github/workflows/release.yml`](.github/workflows/release.yml) and
`specs/s16-packaging.md`.

## What is automated

Pushing a `v*` tag runs the release workflow, which for macOS (universal
`aarch64` + `x86_64`) and Windows:

1. Re-runs `pnpm check`, `pnpm test` and the Rust test suite — a tag never ships
   code that fails the gates.
2. Builds the bundles with `tauri-apps/tauri-action`.
3. Creates a **draft** GitHub Release marked as a pre-release and attaches the
   `.dmg` and the `.exe` installer to it.

Nothing becomes public until you open the draft and press **Publish release**.

Ordinary pushes and pull requests are covered separately by
[`.github/workflows/ci.yml`](.github/workflows/ci.yml), which runs all the
verification gates and confirms both platforms still build.

## Builds are unsigned

Current builds carry no Apple or Windows code signature. They install and run,
but both systems warn the user on first launch. The exact steps a user must
follow are documented in the README's "Download and install" section — keep that
section accurate if this ever changes.

Signing later requires no workflow rewrite: the release workflow already passes
the relevant secrets through. Add them under **Settings → Secrets and variables
→ Actions**:

- macOS: `APPLE_CERTIFICATE` (base64 `.p12`), `APPLE_CERTIFICATE_PASSWORD`,
  `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
- Windows: `WINDOWS_CERTIFICATE` (base64 `.pfx`), `WINDOWS_CERTIFICATE_PASSWORD`

`src-tauri/entitlements.plist` already declares the hardened runtime,
`files.user-selected.read-write` and `device.usb`. Update it only when Tauri or
macOS requirements change, and re-test on a clean macOS install afterwards.

## Manual QA before tagging

CI cannot test the one thing that matters most: real hardware. Run this on a
SmplTrek with firmware 3.2 before tagging.

1. New kit → drag 3 WAVs → compile → the `.stk` loads on the device.
2. Export *Hardware* → verify `SmplTrek/Pool/Kit/*.stk` only.
3. Export *Full* → verify `SmplTrek/Pool/Audio/Drum/*.wav`, `projects/*.json`,
   `README.txt`, and that no existing WAV was overwritten.
4. Move a WAV → reopen the project → red path → **Find missing** → relink.
5. Undo/redo, `Cmd+Z`, Delete, Space preview, `F1` shortcuts.

Record the outcome in
[`docs/research/2026-08-28-STK-Sonicware-compatibility.md`](docs/research/2026-08-28-STK-Sonicware-compatibility.md),
which currently states that no hardware playback run has been verified.

## Versioning

The version must match in three files, which the workflow reads:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json` (injected into the UI via
  `vite.config.ts` → `import.meta.env.APP_VERSION`)

Tag format is `vMAJOR.MINOR.PATCH`. User-facing changes belong in
`CHANGELOG.md`.

## Cutting a release

```bash
# 1. Bump the version in the three files above.
git checkout -b release/v0.1.1
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json CHANGELOG.md
git commit -F .kiro/tmp/commit-msg.txt   # chore - release v0.1.1
git push origin release/v0.1.1
```

Open a pull request, let CI pass, and merge it. Then tag the merged commit and
push only the tag:

```bash
git checkout main && git pull
git tag v0.1.1
git push origin v0.1.1
```

The workflow starts on the tag. When both platform jobs finish, open the draft
release, check that a `.dmg` and an `.exe` are attached, edit the notes, and
publish.

## Hotfix

Branch from the tag, fix, bump the patch version, then tag again:

```bash
git checkout -b hotfix/v0.1.2 v0.1.1
```

## If a release build fails

Read the first failing step, not the last. The most common causes:

| Symptom | Cause |
| --- | --- |
| No `.exe` attached | `bundle.targets` in `tauri.conf.json` lost its `nsis` entry |
| macOS job fails on target | The `universal-apple-darwin` toolchain targets were not installed |
| Gate step fails | The tag was cut from a commit that does not pass CI — fix on a branch and re-tag |

## Building a `.dmg` locally

`pnpm tauri build` produces the disk image by running an AppleScript that
arranges the icons in the Finder window. If your terminal has not been granted
Automation access to Finder, that step fails with:

```
execution error: Apple event not authorized (-1743)
Failed running AppleScript
```

The build itself is fine — only the cosmetic layout step is blocked. Grant the
permission under **System Settings → Privacy & Security → Automation**, allowing
your terminal (or IDE) to control **Finder**, then run the build again. To skip
the disk image entirely while developing, use `pnpm tauri build --bundles app`.

The release workflow builds the real `.dmg` on a GitHub runner, so this local
permission is not required to publish.
