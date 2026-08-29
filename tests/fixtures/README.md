# Fixtures — S17

Add binary fixtures here (git-lfs for .stk / .wav):

- `valid_project.json` — minimal valid project (1 pad, 48k/16/mono)
- `missing_samples.json` — project with 2 missing files for S08
- `invalid_kit_name.json` — kit name empty / with `/`
- `max_pads.json` — 15 active pads filled
- `golden_kit_1.stk` — real SmplTrek 3.2 export (reference)
- `wav_pcm16_mono.wav` / `wav_pcm24_stereo.wav` / etc.

Until real fixtures are committed, tests use synthetic data.
