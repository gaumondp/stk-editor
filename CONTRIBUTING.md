# Contributing to STK Forge

Thanks for helping improve STK Forge, a local desktop editor for Sonicware `.stk` kits.

## Setup

- Node.js 22+
- pnpm 9+
- Rust stable (with the platform build tools Tauri needs)

```bash
pnpm install
```

## Verification

Run these before opening a pull request; all must pass:

```bash
pnpm check          # svelte-check / TypeScript
pnpm test           # frontend unit tests (Vitest)
pnpm test:rust      # Rust unit tests
pnpm test:e2e       # Playwright end-to-end tests
pnpm format:check   # Prettier formatting check
```

## Commits

Use the convention already in this repository: `type - short description`, for
example `feat - add SD card reader` or `fix - exit the macOS application after
the save guard`. Common types: `feat`, `fix`, `chore`.

## Pull requests

Push work to a branch and open a pull request. Never push straight to `main`.
