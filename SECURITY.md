# Security Policy

STK Forge is a **local-only desktop application**. It has no cloud account, no
telemetry, and never uploads your data anywhere.

## Risk surface

The real risk surface is local file handling:

- Parsing untrusted `.stk` and `.wav` files that a user opens or inspects.
- Writing to a user-chosen SD-card or folder destination during compile and export.

Inspecting or opening an input file never modifies that input file. Compiling and
exporting write only to a destination the user selects.

## Reporting a vulnerability

Report a suspected vulnerability privately through the repository at
[github.com/gaumondp/stk-forge](https://github.com/gaumondp/stk-forge) — open a
private security advisory rather than a public issue. Please include the file or
input that triggers the problem and the steps to reproduce it.

## Support status

STK Forge is **pre-alpha**. There is no security-support guarantee, and fixes are
provided on a best-effort basis.
