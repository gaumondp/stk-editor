// .STK compiler.
//
// Builds a binary kit file from a validated project, following the layout
// documented in the reference `file_format.md` and validated against the
// `stkpack.py` reference packer (spec §12.4). Output is SmplTrek fw 3.2 only.

use crate::models::{Project, Sample};
use crate::profile::{known_profile, DeviceProfile};
use crate::wav;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Options controlling a `.stk` compile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompileOptions {
     /// Destination path for the compiled `.stk` file.
     pub output_path: String,
     /// Compile samples to mono (true) or stereo (false).
     pub mono: bool,
     /// Overwrite `output_path` if it already exists.
     pub overwrite: bool
}
impl CompileOptions {
     /// Build options for `output_path` with the safe defaults: mono, no overwrite.
     pub fn new(output_path: &str) -> Self {
       Self {
         output_path: output_path.to_string(),
         mono: true,
         overwrite: false
       }
      }
}

/// Outcome of a successful compile.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CompileReport {
     /// Path the `.stk` was written to.
     pub output_path: String,
     /// Size of the written file in bytes.
     pub bytes: u64,
     /// Number of pads that carried a real sample.
     pub pads_filled: usize,
     /// Non-blocking warnings gathered during validation.
     pub warnings: Vec<String>
}

/// Result of validating a project: blocking errors and non-blocking warnings.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ValidationResult {
     /// Blocking problems that prevent compiling/saving.
     pub errors: Vec<String>,
     /// Advisory issues that do not block.
     pub warnings: Vec<String>
}
impl ValidationResult {
     /// True when there are no blocking errors.
     pub fn is_ok(&self) -> bool {
       self.errors.is_empty()
      }
     /// True when at least one blocking error is present (compile must refuse).
     pub fn blocking(&self) -> bool {
       !self.errors.is_empty()
      }
}

/// Validate a project against its device profile without touching the JSON.
pub fn validate(project: &Project) -> ValidationResult {
      let mut r = ValidationResult::default();
      let prof = match known_profile(&project.device.profile, &project.device.firmware) {
       Ok(p) => p,
         Err(e) => {
          r.errors.push(e);
          return r;
           }
        };
      do_validate_profile(project, prof.as_ref(), &mut r);
      r
}

/// Compile a validated project into a `.stk` archive on disk.
///
/// Validates the project, builds one device WAV per active pad (real samples
/// normalized to 48 kHz/16-bit, empty pads synthesized as silence), assembles
/// the header + KTDT + audio section, and writes it atomically via a temp file.
/// Returns a [`CompileReport`]; errors on validation failure, an existing
/// output when `overwrite` is false, a missing source sample, or any I/O error.
pub fn compile(project: &Project, opts: &CompileOptions) -> Result<CompileReport, String> {
      let prof = known_profile(&project.device.profile, &project.device.firmware)?;

      let v = validate(project);
      if v.blocking() {
        return Err(format!("Validation failed: {}", v.errors.join("; ")));
        }

      let out = Path::new(&opts.output_path);
      if out.exists() && !opts.overwrite {
        return Err(format!("Output file already exists: {}", out.display()));
        }

      // Build WAVs per active pad; the .stk container has exactly 15 audio slots.
      let mut wavs: Vec<(Vec<u8>, String)> = Vec::new();
      let mut filled = 0usize;
      let active_pad_count = prof.active_pads().len();

for pad in prof.active_pads() {
        let sample = project.kit.pads.get(&(pad as u8)).cloned().unwrap_or_default();
        let file_name = sample.file_name.clone();
        let is_filled = !file_name.is_empty();
        let wav_bytes = match resolve_source(sample) {
          Ok(Some(p)) => compile_wav(&p, opts.mono)?,
           Ok(None) => synth_silence(opts.mono),
              Err(e) => return Err(format!("Pad {pad}: {e}")),
               };
        wavs.push((wav_bytes, file_name));
        if is_filled {
          filled += 1;
          }
        }

       while wavs.len() < active_pad_count {
        wavs.push((synth_silence(opts.mono), String::new()));
         }
      wavs.truncate(active_pad_count);

       let bytes = build_stk(prof.as_ref(), project, &wavs)?;

       if let Some(dir) = out.parent() {
         std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
           }
      let tmp = out.with_extension("stk.tmp");
      std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
      std::fs::rename(&tmp, out).map_err(|e| e.to_string())?;

      Ok(CompileReport {
        output_path: opts.output_path.clone(),
        bytes: bytes.len() as u64,
        pads_filled: filled,
        warnings: v.warnings
       })
}

// ---------------------------------------------------------------------------

const MAGIC: &[u8; 4] = crate::stk_format::VDK0_MAGIC;
use crate::stk_format::{
	FIRST_ISDT_OFFSET, GLOBAL_VOLUME_OFFSET, HEADER_FILE_SIZE_ADJUSTMENT, KTDT_SIZE, KTDT_TAG,
	ENTRY_SIZE, PATH_FIELD,
};
const ISDT_SIZE_ADJUSTMENT: usize = 10;

/// Standard device chunks inserted before `data` (file_format §5).
const CUE_CHUNK: &[u8] = b"cue \x1c\x00\x00\x00\x01\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00data\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"; // 36 bytes
const LIST_CHUNK: &[u8] = b"LIST\x1e\x00\x00\x00adtllabl\x12\x00\x00\x00\x01\x00\x00\x00"; // 24 bytes
const LIST_TAIL: &[u8] = b"Tempo: 000.0\x00\x00"; // 14 bytes

fn build_stk(
     prof: &dyn DeviceProfile,
     project: &Project,
     wavs: &[(Vec<u8>, String)]
) -> Result<Vec<u8>, String> {
      let mut out: Vec<u8> = Vec::new();

      // --- Main header (32 bytes) ---
      out.extend_from_slice(MAGIC);
      // Official factory kits store the final file length minus 360 here.
      // It is patched after the variable-length audio section is assembled.
      out.extend_from_slice(&[0u8; 4]);
      out.extend_from_slice(&[0u8; 4]);
      out.extend(&le32(0x10));
      out.extend_from_slice(KTDT_TAG);
      out.extend(&le32(KTDT_SIZE as u32));
      out.extend_from_slice(&[0u8; 4]);
      out.extend(&le32(1));

      // --- KTDT body (4228 bytes) ---
      let mut ktdt = vec![0u8; KTDT_SIZE];

      for (i, pad) in prof.active_pads().iter().take(15).enumerate() {
        let (_wav, name) = &wavs[i];
        let sample = project
             .kit
              .pads
              .get(&(*pad as u8))
              .cloned()
              .unwrap_or_else(|| sample_placeholder(name));

        let mut path = String::new();
        path.push_str(&prof.internal_audio_root(&project.kit.name));
        path.push('/');
        path.push_str(&effective_name(&sample));
        path.push_str(".wav");

        let mut pb = path.into_bytes();
        pb.truncate(PATH_FIELD - 1);
        pb.push(0);
        pb.resize(PATH_FIELD, 0);

        let off = i * ENTRY_SIZE;
        ktdt[off..off + PATH_FIELD].copy_from_slice(&pb);
        set_param(&mut ktdt, off + PATH_FIELD, &sample);
        }

// footer @GLOBAL_VOLUME_OFFSET : 8 zero + 0x64 (global volume)
        if let Some(slice) = ktdt.get_mut(GLOBAL_VOLUME_OFFSET..GLOBAL_VOLUME_OFFSET + 4) {
            slice.copy_from_slice(&[0x64, 0, 0, 0]);
        }


       // first ISDT @FIRST_ISDT_OFFSET (index 0)
      let first = &wavs[0].0;
      write_isdt(&mut ktdt, FIRST_ISDT_OFFSET, 0, first.len());

      out.extend_from_slice(&ktdt);

      // --- Audio section ---
      for (i, (wav, _)) in wavs.iter().enumerate() {
        if i > 0 {
          out.extend_from_slice(&[0u8, 0u8]);
          write_isdt_into(&mut out, i as u32, wav.len());
          }
        out.extend_from_slice(wav);
        }
      out.extend_from_slice(&[0u8, 0u8]);

      let header_file_size = out
          .len()
          .checked_sub(HEADER_FILE_SIZE_ADJUSTMENT)
          .ok_or("STK output is shorter than the official header adjustment")?;
      out[4..8].copy_from_slice(&le32(header_file_size as u32));

      Ok(out)
}

fn sample_placeholder(name: &str) -> Sample {
      Sample {
        id: String::new(),
        file_name: name.to_string(),
        original_file_name: Some(name.to_string()),
        resolved_path: None,
        original_path: String::new(),
        sha256: None,
        meta: Default::default(),
        volume: 100,
        pan: 0,
        pitch: 0,
        fx_send: 0,
        note: None
       }
}

fn effective_name(sample: &Sample) -> String {
      if sample.file_name.is_empty() {"sample".to_string()} else {
         sample.file_name.replace(".wav", "")
      }
}

fn set_param(buf: &mut [u8], off: usize, s: &Sample) {
      buf[off] = s.volume.min(100);
      buf[off + 1] = s.pan as u8;
      buf[off + 2] = 0x00;
      buf[off + 3] = 0x7F;
      buf[off + 4..off + 8].copy_from_slice(&le32(s.pitch as u32));
      buf[off + 16] = s.fx_send.min(127);
      }

fn write_isdt(buf: &mut [u8], off: usize, idx: u32, wav_total: usize) {
      buf[off..off + 4].copy_from_slice(b"ISDT");
      buf[off + 4..off + 8].copy_from_slice(&le32((wav_total + ISDT_SIZE_ADJUSTMENT) as u32));
      buf[off + 8..off + 12].copy_from_slice(&le32(idx));
      buf[off + 12..off + 16].copy_from_slice(&le32(1));
      }

fn write_isdt_into(out: &mut Vec<u8>, idx: u32, wav_total: usize) {
      out.extend_from_slice(b"ISDT");
      out.extend(&le32((wav_total + ISDT_SIZE_ADJUSTMENT) as u32));
      out.extend(&le32(idx));
      out.extend(&le32(1));
      }

fn le32(v: u32) -> [u8; 4] {
       [v as u8, (v >> 8) as u8, (v >> 16) as u8, (v >> 24) as u8]
}
fn le16(v: u16) -> [u8; 2] {
       [v as u8, (v >> 8) as u8]
}

/// Build a device-compatible WAV (48k/16-bit PCM, with cue+LIST pre-data chunks).
pub fn build_wav(pcm: &[i16], channels: u16) -> Vec<u8> {
      let data_bytes = (pcm.len() * 2) as u32;

      let mut fmt = Vec::new();
      fmt.extend_from_slice(b"fmt ");
      fmt.extend(&le32(16));
      fmt.extend(&le16(1)); // PCM
      fmt.extend(&le16(channels));
      fmt.extend(&le32(48000));
      fmt.extend(&le32(48000 * channels as u32 * 2));
      fmt.extend(&le16(channels * 2));
      fmt.extend(&le16(16));

      let extra = CUE_CHUNK.len() + LIST_CHUNK.len() + LIST_TAIL.len();
      let riff_size = 4u32 + fmt.len() as u32 + extra as u32 + (8 + data_bytes);

      let mut w = Vec::with_capacity(8 + riff_size as usize);
      w.extend_from_slice(b"RIFF");
      w.extend(&le32(riff_size));
      w.extend_from_slice(b"WAVE");
      w.extend_from_slice(&fmt);
      w.extend_from_slice(CUE_CHUNK);
      w.extend_from_slice(LIST_CHUNK);
      w.extend_from_slice(LIST_TAIL);
      w.extend_from_slice(b"data");
      w.extend(&le32(data_bytes));
      for s in pcm {
        // Bit-preserving cast: PCM samples are written as their raw 16-bit
        // two's-complement pattern; `as u16` reinterprets the bits, it does not
        // clamp or convert the value.
        w.extend(&le16(*s as u16));
       }
      w
}

fn compile_wav(path: &Path, mono: bool) -> Result<Vec<u8>, String> {
      let (pcm, _) = wav::normalize(path, mono)?;
      Ok(build_wav(&pcm, if mono { 1 } else { 2 }))
}

fn synth_silence(mono: bool) -> Vec<u8> {
       let pcm = vec![0i16; 48000];
      build_wav(&pcm, if mono { 1 } else { 2 })
}

fn resolve_source(sample: Sample) -> Result<Option<std::path::PathBuf>, String> {
      if sample.file_name.is_empty() {
        return Ok(None);
       }
       let path = sample
          .resolved_path
          .as_ref()
          .map(std::path::PathBuf::from)
          .or_else(|| Some(std::path::PathBuf::from(sample.original_path.clone())));
      if let Some(p) = path {
        if !p.exists() {
          return Err(format!("audio file not found: '{}'", sample.original_path));
         }
        return Ok(Some(p));
       }
      Err(format!("no path available for sample '{}'", sample.file_name))
}

// ---------------------------------------------------------------------------

fn do_validate_profile(project: &Project, prof: &dyn DeviceProfile, r: &mut ValidationResult) {
      prof.validate_kit_name(&project.kit.name)
       .map_err(|e| r.errors.push(e))
       .ok();

      let mut total_bytes: u64 = 0;
      // Each active pad must resolve if assigned.
      for pad in prof.active_pads() {
        if let Some(s) = project.kit.pads.get(&(pad as u8)) {
          prof.validate_params(s)
           .map_err(|e| r.errors.push(format!("Pad {pad}: {e}")))
           .ok();

          if !s.file_name.is_empty() {
            match resolve_source(s.clone()) {
              Ok(Some(p)) => {
                if let Ok(meta) = std::fs::metadata(&p) {
                  let sz = meta.len();
                  total_bytes = total_bytes.saturating_add(sz);
                  if sz as usize > prof.max_sample_bytes() {
                    r.errors.push(format!(
                      "Pad {pad}: file too large ({} bytes > {} bytes limit)",
                      sz,
                      prof.max_sample_bytes()
                    ));
                  }
                }
              }
              Ok(None) => {}
              Err(e) => r.errors.push(format!("Pad {pad}: {e}")),
            }
           }
         }
       }

      if let Some(max) = prof.max_kit_bytes() {
        if total_bytes as usize > max {
          r.errors.push(format!(
            "Kit too large ({} bytes > {} bytes limit)",
            total_bytes, max
          ));
        }
      }

       // Special pad must not be assigned in V1 (reserved function).
      for sp in prof.special_pads() {
        if project.kit.pads.contains_key(&(sp as u8)) {
          r.errors.push(format!(
             "Pad {sp} is reserved and must remain empty in fw 3.2"
            ));
          }
       }
}
