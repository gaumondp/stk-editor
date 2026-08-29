# S15 — File & credential security

Status: partial (Tauri capabilities + git redaction exist; audit pending).
Scope: §21, §18.4.

## Scope

Security boundaries for V1: no secrets in files, no arbitrary FS access,
no network exposure beyond explicit user actions.

## Threat model (V1)
- **User data**: project JSON (paths, not audio), recent list, app prefs.
- **Audio files**: user's samples — read-only, never uploaded.
- **Git credentials**: OS credential helper only.
- **No**: user accounts, cloud sync, telemetry, auto-update (V1.1).

## Tauri capabilities (capabilities/default.json)
```json
{
  "permissions": [
    "core:default",
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-read-dir",
    "fs:allow-create-dir",
    "dialog:allow-open",
    "dialog:allow-save",
    "shell:allow-execute"
  ]
}
```
- **No** `fs:allow-read-recursive` / `fs:allow-write-recursive` (no tree walk
  beyond explicit user selection).
- **No** `http` / `websocket` / `network` permissions (offline-first).
- Shell: only `git` binary (allowlist in `tauri.conf.json`).

## File access rules
- Project JSON: user chooses via dialog → path stored in recent (local only).
- Sample files: read via dialog or drag-drop → path stored in project JSON.
- **Never** auto-scan home dir, Documents, etc.
- Export SD: user chooses target dir → write only there.
- Recent list: stored in OS app data dir (not project dir).
- Temp files: `.tmp` + atomic rename; cleanup on success.

## Credential handling (Git)
- `git` invoked with `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`.
- URLs stored in git config (user's `~/.gitconfig`) — not in our JSON.
- Remote URLs displayed/transmitted **redacted**: `https://***@github.com/...`
- Error output scrubbed: `redact_err()` strips credentials.
- No SSH key management (user configures `ssh-agent` / `~/.ssh`).

## Project JSON security
- Contains: **paths only** (absolute or relative), no audio data.
- `originalPath` preserved for relink — may reveal directory structure.
  - Mitigation: user controls what they save; no auto-exfiltration.
- No tokens, passwords, API keys, personal data.
- SHA256 of audio files — not reversible, used for matching only.

## IPC / command validation
- All Tauri commands: typed inputs (serde), validated in Rust.
- Path traversal: `normalize_path` resolves relative → absolute, no `..`
  escape outside allowed dirs (user-selected only).
- File size limits: `list_wavs` / `audio_meta` on user-selected files only.
- No command accepts raw SQL / shell / eval.

## Build / supply chain
- `Cargo.lock` + `pnpm-lock.yaml` committed.
- `cargo audit` / `pnpm audit` in CI.
- Dependencies: minimal, well-maintained (Tauri, serde, walkdir, hound).
- No `unsafe` in Rust code (deny in CI).

## Runtime hardening
- `CSP` in `tauri.conf.json`: `default-src 'self'; script-src 'self'`.
- No `eval` / `Function` in frontend.
- External links: `https://` only, opened in system browser (not webview).

## Gaps / TODOs
- [ ] Full capability audit: verify `default.json` matches actual usage.
- [ ] `shell` allowlist: restrict to `git` only (currently open).
- [ ] CSP: tighten `img-src` / `font-src` for local assets only.
- [ ] Fuzz test Tauri commands with malformed inputs.
- [ ] Penetration test: path traversal, command injection, XSS.
- [ ] Document security model in README (user-facing).

## Acceptance
- `tauri.conf.json` capabilities minimal for features.
- No `fs:allow-read-recursive` / `fs:allow-write-recursive`.
- No network permissions.
- Git credentials never in logs, JSON, IPC, or exports.
- Path traversal attempts blocked (test with `../../etc/passwd`).
- `cargo audit` + `pnpm audit` clean in CI.
- No `unsafe` in Rust crate.