// Hardware abstraction layer.
//
// A `DeviceProfile` centralizes every piece of hardware-specific knowledge so
// that a new Sonicware device or firmware version can be added without touching
// the core project, compiler or UI logic (spec §4.2).
//
// V1 ships exactly one profile: SmplTrek firmware 3.2.

use crate::models::Sample;

/// A hardware profile knows everything that varies between devices/firmware.
pub trait DeviceProfile: Send + Sync {
    /// Stable profile id, e.g. "smpltrek".
    fn id(&self) -> &str;
    /// Firmware this profile is validated against, e.g. "3.2".
    fn firmware(&self) -> &str;
    /// Human-readable device name.
    fn name(&self) -> &str;

    /// Number of physical pads on the device.
    fn pad_count(&self) -> usize;
    /// 1-based list of active (playable) pads.
    fn active_pads(&self) -> Vec<usize>;
    /// Pads that are shown but reserved for a special hardware function.
    fn special_pads(&self) -> Vec<usize>;

    /// Internal WAV path root written into the STK (file_format.md §5).
    fn internal_audio_root(&self, kit_title: &str) -> String;

    /// Maximum length of the internal sample path (bytes, incl. trailing NUL).
    fn max_internal_path_bytes(&self) -> usize;

    /// Minimum/maximum kit-name length accepted by the device.
    fn min_kit_name_len(&self) -> usize;
    fn max_kit_name_len(&self) -> usize;

    /// Validate a kit title; returns a human error when unacceptable.
    fn validate_kit_name(&self, name: &str) -> Result<(), String>;

    /// Validate the per-pad sample parameter ranges.
    fn validate_params(&self, sample: &Sample) -> Result<(), String>;

    /// Whether pad index (1-based) is playable.
    fn is_playable(&self, pad: usize) -> bool {
        self.active_pads().contains(&pad)
    }

    /// Whether pad index (1-based) is a special/reserved pad.
    fn is_special(&self, pad: usize) -> bool {
        self.special_pads().contains(&pad)
    }

    /// Folders expected on the SD card for this device (export profile).
    fn sd_root_folders(&self) -> Vec<String>;
    /// Folders used for "hardware-only" export (subset of sd_root_folders).
    fn sd_hardware_folders(&self) -> Vec<String>;

    /// Maximum sample file size in bytes (S03/S04 audit placeholder: 4 MiB per pad).
    fn max_sample_bytes(&self) -> usize {
        4 * 1024 * 1024
    }
    /// Maximum total audio payload per kit (optional, SmplTrek ~32 MiB).
    fn max_kit_bytes(&self) -> Option<usize> {
        Some(32 * 1024 * 1024)
    }
}

/// SmplTrek firmware 3.2 profile — the only profile guaranteed in V1.
pub struct SmplTrek32;

impl DeviceProfile for SmplTrek32 {
    fn id(&self) -> &str {
        "smpltrek"
    }
    fn firmware(&self) -> &str {
        "3.2"
    }
    fn name(&self) -> &str {
        "Sonicware SmplTrek"
    }
    fn pad_count(&self) -> usize {
        16
    }
    fn active_pads(&self) -> Vec<usize> {
        (1usize..=15).collect()
    }
    fn special_pads(&self) -> Vec<usize> {
        vec![16]
    }
    fn internal_audio_root(&self, kit_title: &str) -> String {
        format!("SmplTrek/Pool/Audio/Drum/{kit_title}")
    }
    fn max_internal_path_bytes(&self) -> usize {
        256
    }
    fn min_kit_name_len(&self) -> usize {
        1
    }
    fn max_kit_name_len(&self) -> usize {
        16
    }
    fn validate_kit_name(&self, name: &str) -> Result<(), String> {
        if name.trim().is_empty() {
            return Err("Kit name must not be empty".to_string());
        }
        let n = name.chars().count();
        if n < self.min_kit_name_len() {
            return Err(format!(
                "Kit name must be at least {} character(s)",
                self.min_kit_name_len()
            ));
        }
        if n > self.max_kit_name_len() {
            return Err(format!(
                "Kit name must be at most {} characters (SmplTrek 3.2 limit)",
                self.max_kit_name_len()
            ));
        }
        // Device internal paths use ASCII.
        for c in name.chars() {
            if !c.is_ascii() {
                return Err(format!("Kit name must be ASCII-only, found '{c}'"));
            }
        }
        // A leading dot or a separator breaks the on-device directory tree.
        if name.starts_with('.') || name.contains('/') || name.contains('\\') {
            return Err("Kit name may not contain '.' '/' or '\\'".to_string());
        }
        Ok(())
    }
    fn validate_params(&self, sample: &Sample) -> Result<(), String> {
        if sample.volume > 100 {
            return Err("Volume must be 0-100".to_string());
        }
        if !pan_ok(sample.pan) {
            return Err("Pan must be -64..63".to_string());
        }
        if !(sample.pitch >= -1200 && sample.pitch <= 1200) {
            return Err("Pitch must be -1200..1200 cents".to_string());
        }
        if sample.fx_send > 127 {
            return Err("FX send must be 0-127".to_string());
        }
        Ok(())
    }
    fn sd_root_folders(&self) -> Vec<String> {
        vec![
            "SmplTrek/Pool/Kit".to_string(),
            "SmplTrek/Pool/Audio/Drum".to_string(),
        ]
    }
    fn sd_hardware_folders(&self) -> Vec<String> {
        vec!["SmplTrek/Pool/Kit".to_string()]
    }
}

fn pan_ok(pan: i8) -> bool {
    // -64..63 inclusive
    pan as i16 >= -64 && pan as i16 <= 63
}

/// Dummy 8-pad device for S00 architecture test — proves profile-driven design.
pub struct DummyDevice;

impl DeviceProfile for DummyDevice {
    fn id(&self) -> &str { "dummy" }
    fn firmware(&self) -> &str { "1.0" }
    fn name(&self) -> &str { "Dummy 8-Pad" }
    fn pad_count(&self) -> usize { 8 }
    fn active_pads(&self) -> Vec<usize> { (1usize..=8).collect() }
    fn special_pads(&self) -> Vec<usize> { vec![] }
    fn internal_audio_root(&self, kit_title: &str) -> String { format!("Dummy/Pool/{kit_title}") }
    fn max_internal_path_bytes(&self) -> usize { 256 }
    fn min_kit_name_len(&self) -> usize { 1 }
    fn max_kit_name_len(&self) -> usize { 12 }
    fn validate_kit_name(&self, name: &str) -> Result<(), String> {
        if name.trim().is_empty() { return Err("Kit name must not be empty".into()); }
        if name.len() > 12 { return Err("Dummy kit max 12 chars".into()); }
        Ok(())
    }
    fn validate_params(&self, sample: &Sample) -> Result<(), String> {
        if sample.volume > 100 { return Err("Volume must be 0-100".into()); }
        Ok(())
    }
    fn sd_root_folders(&self) -> Vec<String> { vec!["Dummy/Kit".to_string(), "Dummy/Audio".to_string()] }
    fn sd_hardware_folders(&self) -> Vec<String> { vec!["Dummy/Kit".to_string()] }
}

/// Registry of known profiles. Extend this map to add future devices.
pub fn known_profile(id: &str, firmware: &str) -> Result<Box<dyn DeviceProfile>, String> {
    match id {
        "smpltrek" => {
            if firmware != "3.2" {
                return Err(format!(
                    "Firmware {firmware} is not validated for profile '{id}' in V1 (only 3.2 is supported)"
                ));
            }
            Ok(Box::new(SmplTrek32) as Box<dyn DeviceProfile>)
        }
        "dummy" => {
            if firmware != "1.0" {
                return Err(format!("Firmware {firmware} not validated for dummy (only 1.0)"));
            }
            Ok(Box::new(DummyDevice) as Box<dyn DeviceProfile>)
        }
        _ => Err(format!("Unknown device profile '{id}'")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dummy_profile_renders_without_core_changes() {
        let p = known_profile("dummy", "1.0").unwrap();
        assert_eq!(p.pad_count(), 8);
        assert_eq!(p.active_pads().len(), 8);
        assert!(p.special_pads().is_empty());
        // Compile would use this profile without touching compile/export/UI
    }

    #[test]
    fn known_profile_rejects_unknown() {
        assert!(known_profile("unknown", "1.0").is_err());
        assert!(known_profile("smpltrek", "9.9").is_err());
    }
}
