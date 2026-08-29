# S12 — Git integration (GitHub + Grok)

Status: partial (Rust `git.rs` + Tauri commands + store hooks exist; UI partial).
Scope: §18.

## Scope

Thin wrapper over system `git` binary for project version control.
Supports GitHub and Grok (x.ai) remotes as first-class; others as "other".
Credentials via OS credential helper only — never stored.

## Security (§18.4)
- **Tokens NEVER** written to JSON project, logs, exports, or IPC.
- `git` invoked with `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`.
- URLs redacted in all UI / logs / errors: `https://***@github.com/...`
- Error messages scrubbed of credentials before reaching frontend.

## Tauri commands (commands.ts)
```ts
gitInit(dir)           // git init
gitRemotes()           // list with kind (github/grok/other)
gitSetRemote(name, url)
gitStatus()            // branch, modified, untracked, ahead/behind, conflicts
gitCommit(message)
gitFetch()
gitPull()
gitPush()
gitBranch(name, create)
gitLog(max)
```

## GitRemote kind detection
- `github` → `github.com` or `githubusercontent.com`
- `grok` → `grok`, `x.ai`, `grok.com`
- `other` → everything else

## UI (TopBar + KitPanel)
- **TopBar indicator**: clean / ↑ahead / ↓behind / ⚠ conflict / ⟳ syncing.
  - Driven by `gitStatus()` poll (manual refresh + auto after push/pull/fetch).
- **KitPanel Git section** (when project is in a repo):
  - Current branch.
  - Modified files count (click → list).
  - Untracked files count.
  - Ahead/behind badges.
  - Buttons: Fetch, Pull, Push, Commit (opens dialog), Branch (create/switch).
- **Remote manager** (Settings / Help menu):
  - List remotes with kind badges.
  - Add/Edit/Remove remote (URL input, validated).
  - Test connection (fetch dry-run).

## Workflow (V1)
1. User opens project in a git repo → auto-detects, shows status.
2. User edits → `modified` files tracked.
3. Commit: message dialog → `git add -A && git commit -m "msg"`.
4. Push/Pull/Fetch: one-click, shows progress toast, updates status.
5. Branch: create new / switch existing.
6. Conflict: status pill → `git_conflict` (red), KitPanel shows conflicted files.

## Tauri command details
- All commands return `Result<T, String>`; errors redacted.
- `gitStatus()` called on: app start (if project in repo), after commit,
  push, pull, fetch, branch switch.
- `gitLog(20)` for history panel (V1.1).

## Gaps / TODOs
- [ ] UI: TopBar git indicator (icon + tooltip with ahead/behind).
- [ ] UI: KitPanel Git section (currently only store hooks).
- [ ] UI: Commit dialog (message input + staged files list).
- [ ] UI: Remote manager dialog.
- [ ] Auto-refresh status on file system changes (watch project dir).
- [ ] Shallow clone support for large repos (V1.1).
- [ ] GPG/SSH key detection hint (read from `~/.ssh`, `git config`).
- [ ] Test: credential helper works on macOS (Keychain) + Windows (GCM).

## Acceptance
- `git init` in project dir → repo created, status shows clean.
- Add remote (GitHub HTTPS) → kind = github, URL redacted in UI.
- Edit file → status shows 1 modified.
- Commit → status clean, log shows commit.
- Push → ahead=0, behind=0, toast success.
- Pull with upstream changes → behind=0, files updated.
- Conflict scenario → status `git_conflict`, pill red, files listed.
- No tokens in any output, log, JSON, or export.
- Works offline (fetch/pull/push fail gracefully with redacted error).