// Core data models for the SmplTrek Kit Builder.
// These are the canonical JSON working format (spec §11).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Canonical project identifier written into JSON files.
pub const PROJECT_FORMAT: &str = "smpltrek-kit-project";
/// Current on-disk project schema version (bumped when the JSON shape changes).
pub const PROJECT_FORMAT_VERSION: u32 = 1;
/// Application version, taken from the crate version at build time.
pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Target device identity: which profile and firmware a project is built for.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Device {
      #[serde(default = "default_profile")]
     pub profile: String,
      #[serde(default = "default_firmware")]
     pub firmware: String
}

impl Device {
     /// The only device supported in V1: SmplTrek, firmware 3.2.
     pub fn smpltrek_3_2() -> Self {
      Self {
       profile: "smpltrek".to_string(),
       firmware: "3.2".to_string()
    }
   }
}

impl Default for Device {
     fn default() -> Self {
      Self::smpltrek_3_2()
     }
}

/// Audio metadata captured when a sample is (re)linked, best-effort.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AudioMeta {
     #[serde(skip_serializing_if = "Option::is_none")]
     pub duration_ms: Option<u64>,
     #[serde(skip_serializing_if = "Option::is_none")]
     pub sample_rate: Option<u32>,
     #[serde(skip_serializing_if = "Option::is_none")]
     pub bits: Option<u16>,
     #[serde(skip_serializing_if = "Option::is_none")]
     pub channels: Option<u16>,
     #[serde(skip_serializing_if = "Option::is_none")]
     pub byte_size: Option<u64>
}

/// A stable identity for a sample, independent of its current location.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sample {
     /// Stable id chosen by the app (used for matching / relink).
     pub id: String,
     pub file_name: String,
     /// Display name that survives rename on disk (optional, S02).
     #[serde(default, skip_serializing_if = "Option::is_none")]
     pub original_file_name: Option<String>,
     /// Path resolved on the current machine (relative to project or absolute).
     #[serde(skip_serializing_if = "Option::is_none")]
     pub resolved_path: Option<String>,
     /// Original location — always preserved even after a move/relink (§10.3).
     pub original_path: String,
     /// SHA-256 of the file contents if available.
     #[serde(skip_serializing_if = "Option::is_none")]
     pub sha256: Option<String>,
     #[serde(default, skip_serializing_if = "AudioMeta::is_empty")]
     pub meta: AudioMeta,
     // Per-pad parameters written into the STK (§12 / file_format).
     #[serde(default = "default_vol")]
     pub volume: u8,
     #[serde(default = "default_pan")]
     pub pan: i8,
     #[serde(default)]
     pub pitch: i32,
     #[serde(default = "default_fx")]
     pub fx_send: u8,
     #[serde(default = "default_note")]
     pub note: Option<String>
}

fn default_vol() -> u8 { 100 }
fn default_pan() -> i8 { 0 }
fn default_fx() -> u8 { 0 }
fn default_note() -> Option<String> { None }

impl Sample {
     pub fn is_empty(&self) -> bool {
      self.file_name.is_empty() && self.resolved_path.is_none()
      }
}

impl Default for Sample {
     fn default() -> Self {
      Self {
        id: String::new(),
        file_name: String::new(),
        original_file_name: None,
        resolved_path: None,
        original_path: String::new(),
        sha256: None,
        meta: AudioMeta::default(),
        volume: 100,
        pan: 0,
        pitch: 0,
        fx_send: 0,
        note: None
        }
      }
}

impl AudioMeta {
     fn is_empty(&self) -> bool {
      self.duration_ms.is_none()
       && self.sample_rate.is_none()
       && self.bits.is_none()
       && self.channels.is_none()
       && self.byte_size.is_none()
     }
}

/// A kit: its name, its pad-to-sample map, and free-form notes.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Kit {
     pub name: String,
     /// pad index (1-based, 1..=16) -> sample. 16 may be special/disabled.
     pub pads: BTreeMap<u8, Sample>,
     #[serde(default, skip_serializing_if = "String::is_empty")]
     pub notes: String
}

/// Record of the most recent compile of a project (for UI display).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CompileInfo {
     #[serde(default)]
     pub last_compiled: Option<String>,
     #[serde(default)]
     pub output_path: Option<String>,
     #[serde(default)]
     pub target: Option<String>
}

/// Per-project export/compile preferences.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProjectPrefs {
     #[serde(default)]
     pub copy_samples: bool,
     #[serde(default)]
     pub sd_profile: Option<String>
}

impl ProjectPrefs {
     fn is_empty(&self) -> bool {
      !self.copy_samples
     }
}

/// The canonical working project: format/version stamps, target device, kit,
/// last-compile info and preferences. This is the JSON persisted on disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
     pub format: String,
     #[serde(default = "default_fv")]
     pub fmt_version: u32,
     pub app_version: String,
     pub device: Device,
     pub kit: Kit,
     #[serde(default, skip_serializing_if = "CompileInfo::is_empty")]
     pub compile: CompileInfo,
     #[serde(default, skip_serializing_if = "ProjectPrefs::is_empty")]
     pub prefs: ProjectPrefs
}

/// Default project schema version for serde-defaulted fields.
pub fn default_fv() -> u32 { PROJECT_FORMAT_VERSION }
/// Default device profile id.
pub fn default_profile() -> String { "smpltrek".to_string() }
/// Default device firmware.
pub fn default_firmware() -> String { "3.2".to_string() }

impl CompileInfo {
     fn is_empty(&self) -> bool {
      self.last_compiled.is_none()
       && self.output_path.is_none()
       && self.target.is_none()
     }
}

impl Project {
     /// Create an empty project named `name`, targeting SmplTrek fw 3.2.
     pub fn new(name: &str) -> Self {
      Self {
       format: PROJECT_FORMAT.to_string(),
       fmt_version: PROJECT_FORMAT_VERSION,
       app_version: APP_VERSION.to_string(),
       device: Device::smpltrek_3_2(),
       kit: Kit {
        name: name.to_string(),
        pads: BTreeMap::new(),
        notes: String::new()
     },
     compile: CompileInfo::default(),
     prefs: ProjectPrefs::default()
    }
   }
}

impl Default for Project {
     fn default() -> Self {
      Self::new("NewKit")
     }
}

/// Serializable device profile info for the frontend (spec §4.2).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceProfileInfo {
     pub id: String,
     pub firmware: String,
     pub name: String,
     pub pad_count: usize,
     pub active_pads: Vec<usize>,
     pub special_pads: Vec<usize>,
     pub internal_audio_root: String,
     pub max_internal_path_bytes: usize,
     pub min_kit_name_len: usize,
     pub max_kit_name_len: usize,
     pub sd_root_folders: Vec<String>,
     pub sd_hardware_folders: Vec<String>,
     pub max_sample_bytes: usize,
     pub max_kit_bytes: Option<usize>
}

impl DeviceProfileInfo {
     /// Build the frontend-facing profile info from a [`DeviceProfile`],
     /// resolving path fields for `kit_title`.
     pub fn from_profile(profile: &dyn crate::profile::DeviceProfile, kit_title: &str) -> Self {
      Self {
        id: profile.id().to_string(),
        firmware: profile.firmware().to_string(),
        name: profile.name().to_string(),
        pad_count: profile.pad_count(),
        active_pads: profile.active_pads(),
        special_pads: profile.special_pads(),
        internal_audio_root: profile.internal_audio_root(kit_title),
        max_internal_path_bytes: profile.max_internal_path_bytes(),
        min_kit_name_len: profile.min_kit_name_len(),
        max_kit_name_len: profile.max_kit_name_len(),
        sd_root_folders: profile.sd_root_folders(),
        sd_hardware_folders: profile.sd_hardware_folders(),
        max_sample_bytes: profile.max_sample_bytes(),
        max_kit_bytes: profile.max_kit_bytes()
      }
   }
}
