# STK Compatibility — Evidence and Claim Boundaries

> **Scope.** This document records what STK Forge actually knows about `.stk`
> support across Sonicware products, and separates **verified fact** from
> **vendor claim** from **assumption**. It is the evidential basis for the
> three-tier compatibility table in [`../../README.md`](../../README.md).
>
> **Source discipline.** Every claim below cites either a file that exists in
> this repository or an external work that this project has actually read. No
> firmware release note, forum thread, or Sonicware product page is cited
> unless it was read. Where a claim has no such source, it is labelled
> **UNVERIFIED** or **VENDOR CLAIM**, with the test that would confirm it.

## 1. What was verified, and against what

| # | Verified fact | How / against what | Date |
| --- | --- | --- | --- |
| V1 | The `.stk` container layout STK Forge writes — 32-byte main header, `KTDT` chunk of 4228 bytes with 15 × 280-byte pad entries, concatenated `ISDT` + `RIFF/WAVE` audio — matches the documented field-level format. | Documented in [`../file_format.md`](../file_format.md), originally reverse-engineered by [jblamber/stk_writer](https://github.com/jblamber/stk_writer). The implementation in `src-tauri/src/compile.rs` builds this layout and states it was validated against the `stkpack.py` reference packer (spec §12.4). | See `docs/file_format.md` |
| V2 | Factory kits use the 4-byte `VDK0` magic followed by a little-endian size field equal to **file length minus 360 bytes** — not the earlier `VDK0PR \0` assertion. | Verified against **15 official kits on a real SmplTrek SD card**. Recorded in the factory-card verification note in [`../file_format.md`](../file_format.md). | 2026-08-30 |
| V3 | STK Forge's inspector accepts both the official `VDK0` header (with the length−360 size field) and the legacy `VDK0PR \0` header. | `src-tauri/src/stk_inspect.rs` — `has_valid_header()` checks `OFFICIAL_MAGIC` (`VDK0`) with `HEADER_FILE_SIZE_ADJUSTMENT`, or `LEGACY_MAGIC` (`VDK0PR \0`). | current source |
| V4 | The active device profile targets **Sonicware SmplTrek, firmware 3.2**: 16 physical pads (15 playable pads 1–15, pad 16 reserved/special), audio normalised to **48 kHz, 16-bit linear PCM** (mono or stereo), kit name 1–16 characters, internal sample path ≤ 256 bytes, ~4 MiB per sample and ~32 MiB per kit. | `src-tauri/src/profile.rs` — `SmplTrek32` (`firmware() == "3.2"`, `pad_count() == 16`, `active_pads() == 1..=15`, `special_pads() == [16]`, `max_kit_name_len() == 16`, `max_internal_path_bytes() == 256`, `max_sample_bytes()`, `max_kit_bytes()`). Compile-time normalisation to 48 kHz/16-bit is in `src-tauri/src/compile.rs`. | current source |

**What "verified" covers and does not.** V1–V4 establish that STK Forge writes
a **structurally correct SmplTrek fw 3.2 container** and that its header
assumptions match real factory cards. Structural correctness is not the same as
a device successfully loading and playing the kit end to end. This project has
verified the file *shape*; it has not published a record of a produced `.stk`
being loaded and played on SmplTrek hardware here. That end-to-end playback
confirmation is treated as an open item (see §5, Q1).

## 2. Vendor claim NOT validated by this project — ELZ_1 Play

**VENDOR CLAIM.** Sonicware documents an **STK DRUMMER** engine on the
**ELZ_1 Play** and describes using "STK data created with SmplTrek." STK Forge
surfaces this to the user as an explicitly *unverified* claim, not as a finding:

- `README.md` compatibility table — ELZ_1 Play row, status **Unverified**.
- `src/lib/i18n.ts` — `welcome.elz1`: *"ELZ_1 Play STK data is documented by
  Sonicware, but is not verified by STK Forge."*
- `src/lib/i18n.ts` — `about.compatibility`: *"Sonicware documents
  SmplTrek-created STK data for ELZ_1 Play; STK Forge has not validated that
  workflow."*

**Status of the underlying Sonicware documentation.** This document does **not**
cite a specific Sonicware URL, manual page, or firmware note for the STK DRUMMER
claim, because none was read and verified while writing this file. The claim is
recorded here only as *"Sonicware is reported to document this"*, at the same
confidence the user-facing strings already assert — no higher.

**Test that would resolve it (see §5, Q2):** obtain the ELZ_1 Play manual /
firmware documentation from Sonicware, cite the exact page, then load a
STK Forge–compiled `.stk` on ELZ_1 Play hardware and confirm STK DRUMMER plays
it. Until both halves are done, ELZ_1 Play stays **Unverified**.

## 3. Unsupported, with the reason

| Product | Reason it is unsupported |
| --- | --- |
| Original **ELZ_1**, **LIVEN** series, **Lofi-12**, and other Sonicware products | No evidence of `.stk` support was found in the source material this project has actually reviewed (`docs/file_format.md`, jblamber/stk_writer, the SmplTrek factory card). STK Forge ships exactly one device profile (`SmplTrek32` in `src-tauri/src/profile.rs`); there is no profile, no format evidence, and no test for any of these devices. Absence of evidence is stated as such — it is not a positive finding that these devices *cannot* use `.stk`, only that this project has none. |

## 4. What remains unknown about the container

These are documented in [`../file_format.md`](../file_format.md) as unknown or
inferred, and are **UNVERIFIED** here:

- **U1.** Several header/reserved fields are labelled "Reserved" or carry a
  constant of unconfirmed purpose (e.g. the `0x7F` byte at pad-entry offset
  `0x103`, described in `file_format.md` as *"maybe important for stability"*).
- **U2.** The `ISDT` size-field formula is documented two ways
  (`WAV_TOTAL + 10` and `RIFF_SIZE + 18`) in `file_format.md`; both are
  reverse-engineered inferences, not a Sonicware-published formula.
- **U3.** The exact set of WAV sub-chunks the device *requires* vs *tolerates*
  (`cue `, `LIST/adtl/labl` with a `Tempo` string) is taken from factory-kit
  observation in `file_format.md`, not from a device specification.
- **U4.** Behaviour on firmware other than 3.2 is entirely unknown; the profile
  is validated against 3.2 only.

## 5. Open questions and the test that resolves each

| Q | Open question | Test that would resolve it |
| --- | --- | --- |
| Q1 | Does a STK Forge–compiled `.stk` load and play correctly on SmplTrek fw 3.2 hardware, end to end? | Compile a multi-pad kit, copy it to a SmplTrek SD card, load it on the device, and confirm each pad triggers the correct sample at the expected volume/pan/pitch. Record the firmware build and the result. |
| Q2 | Is the ELZ_1 Play STK DRUMMER workflow real and compatible with STK Forge output? | Cite the exact Sonicware ELZ_1 Play documentation page for STK DRUMMER, then load a STK Forge–compiled `.stk` on ELZ_1 Play hardware and confirm playback. Both the citation and the hardware test are required. |
| Q3 | Are the "Reserved"/constant header bytes (U1) actually load-bearing? | Produce two otherwise-identical kits differing only in those bytes, load both on hardware, and compare behaviour. |
| Q4 | Which `ISDT` size formula (U2) is correct, and which WAV sub-chunks (U3) are mandatory? | Byte-compare STK Forge output against factory kits across several kit sizes; then load minimal-chunk kits on hardware to see which chunks the device rejects. |
| Q5 | Does `.stk` work on any non-SmplTrek Sonicware device? | Requires a cited Sonicware source of support plus a hardware test on that device. None currently exists. |

## 6. Disclaimer posture (matches the README)

STK Forge is an **independent, MIT-licensed** project and is **not affiliated
with, endorsed by, or supported by Sonicware**. A structurally valid `.stk`
file is **not** a compatibility guarantee: the container layout can be correct
while device behaviour differs by firmware, and Sonicware may change behaviour
in future firmware. Verify every output on the exact hardware and firmware you
intend to use before relying on a kit. This posture is identical to the one in
[`../../README.md`](../../README.md) ("A successful compile is not proof of
compatibility with untested firmware or hardware").

## Appendix — every UNVERIFIED / VENDOR-CLAIM item in this document

- **VENDOR CLAIM (§2):** ELZ_1 Play STK DRUMMER supports SmplTrek-created STK
  data — recorded as reported, no Sonicware URL cited/read.
- **UNVERIFIED (§1):** End-to-end playback of a STK Forge–compiled `.stk` on
  SmplTrek fw 3.2 hardware (structure verified; playback not recorded here).
- **UNVERIFIED (§4, U1):** Purpose of the `0x7F` byte at pad offset `0x103` and
  other reserved header fields.
- **UNVERIFIED (§4, U2):** Which `ISDT` size formula is authoritative.
- **UNVERIFIED (§4, U3):** Which WAV sub-chunks the device requires vs tolerates.
- **UNVERIFIED (§4, U4):** Behaviour on any firmware other than 3.2.
- **UNVERIFIED (§3):** Whether non-SmplTrek Sonicware devices can use `.stk` at
  all — this project has no evidence either way.
