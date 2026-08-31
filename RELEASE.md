# Release Process

The product is **STK Forge**. The Rust crate, the Windows executable name and the
JSON schema name `smpltrek-kit-project` intentionally keep the legacy
`smpltrek-kit-builder` identifier for backward compatibility, so those names are
correct below and are not a stale product name.

Releases are built by GitHub Actions, not by hand. See
[`.github/workflows/release.yml`](.github/workflows/release.yml) and
`specs/s16-packaging.md`.

## What is automated

Pushing a `v*` tag runs the release workflow. Two independent jobs, one per
platform, each of which:

1. Re-runs `pnpm check`, `pnpm test` and the Rust test suite — a tag never ships
   code that fails the gates.
2. Builds its platform's artifact.
3. Attaches it to a **draft** GitHub Release marked as a pre-release.

| Platform | Artifact | How |
| --- | --- | --- |
| macOS | `.dmg` | universal `aarch64` + `x86_64` disk image |
| Windows | `.exe` | the NSIS installer declared in `tauri.conf.json` |

Nothing becomes public until you open the draft and press **Publish release**.

### Why the steps are explicit

An earlier version delegated everything to `tauri-apps/tauri-action`. The macOS
job failed there and the action reported only `failed with exit code 1`; the
underlying error was not in the job annotations, and Actions logs cannot be read
without signing in. Named steps running the command with `--verbose` put the real
error in the log instead.

The workflow also sets `CI: true` explicitly, even though GitHub already does.
That variable is what makes Tauri skip the disk image's Finder AppleScript — see
"Building a `.dmg` locally" below. Removing it breaks the macOS release.

Ordinary pushes and pull requests are covered separately by
[`.github/workflows/ci.yml`](.github/workflows/ci.yml), which runs all the
verification gates and confirms both platforms still build, disk image included.

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
release and check that it carries the macOS `.dmg` and the Windows `.exe`. Both
jobs fail loudly when their artifact is missing, so a release can never ship
without a download. Edit the notes, then publish.

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
| No `.dmg` attached | Usually `CI` is no longer set, so the Finder AppleScript ran and failed — see below |
| Gate step fails | The tag was cut from a commit that does not pass CI — fix on a branch and re-tag |

## Building a `.dmg` locally

`pnpm tauri build` arranges the icons in the disk image's Finder window with an
AppleScript. If your terminal has not been granted Automation access to Finder,
that step fails and takes the whole build with it:

```
execution error: Apple event not authorized (-1743)
Failed running AppleScript
```

Set `CI=true` and the problem disappears — Tauri then passes `--skip-jenkins` to
`bundle_dmg.sh`, which skips the cosmetic AppleScript entirely:

```bash
CI=true pnpm tauri build --target universal-apple-darwin
```

That is exactly how the release workflow builds it, which is why the disk image
it produces is not affected by any local permission. The alternative is to grant
the permission under **System Settings → Privacy & Security → Automation**,
allowing your terminal or IDE to control **Finder**.
