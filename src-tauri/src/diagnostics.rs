// Reproducible environment diagnostics for the About dialog.
//
// Uses ONLY the Rust standard library plus macOS `sw_vers` / `sysctl` invoked
// through `std::process::Command`. No new crate dependency is introduced. Every
// probe has a safe fallback so the command never fails: an unavailable value is
// reported as "unknown" rather than erroring.

use serde::{Deserialize, Serialize};

/// Machine + application facts shown (and copyable) in the About dialog.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
	/// Application version (from Cargo package version).
	pub app_version: String,
	/// Human OS name, e.g. "macOS 14.5" or the target OS on other platforms.
	pub os: String,
	/// CPU brand string, e.g. "Apple M2 Pro".
	pub cpu: String,
	/// Target architecture, e.g. "aarch64" or "x86_64".
	pub arch: String,
	/// Total physical RAM in bytes (0 when it cannot be determined).
	pub ram_bytes: u64,
}

/// Run a command and return trimmed stdout, or `None` on any failure.
///
/// Only the macOS probes shell out, so this is gated to that target: compiled
/// unconditionally it is dead code everywhere else, which fails a
/// `-D warnings` clippy run on Linux.
#[cfg(target_os = "macos")]
fn run(cmd: &str, args: &[&str]) -> Option<String> {
	let out = std::process::Command::new(cmd).args(args).output().ok()?;
	if !out.status.success() {
		return None;
	}
	let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
	if s.is_empty() {
		None
	} else {
		Some(s)
	}
}

#[cfg(target_os = "macos")]
fn os_name() -> String {
	let product = run("sw_vers", &["-productName"]).unwrap_or_else(|| "macOS".to_string());
	match run("sw_vers", &["-productVersion"]) {
		Some(v) => format!("{product} {v}"),
		None => product,
	}
}

#[cfg(not(target_os = "macos"))]
fn os_name() -> String {
	std::env::consts::OS.to_string()
}

#[cfg(target_os = "macos")]
fn cpu_brand() -> String {
	run("sysctl", &["-n", "machdep.cpu.brand_string"]).unwrap_or_else(|| "unknown".to_string())
}

#[cfg(not(target_os = "macos"))]
fn cpu_brand() -> String {
	"unknown".to_string()
}

#[cfg(target_os = "macos")]
fn ram_bytes() -> u64 {
	run("sysctl", &["-n", "hw.memsize"])
		.and_then(|s| s.parse::<u64>().ok())
		.unwrap_or(0)
}

#[cfg(not(target_os = "macos"))]
fn ram_bytes() -> u64 {
	0
}

/// Collect diagnostics. Infallible: every field has a fallback.
pub fn collect() -> Diagnostics {
	Diagnostics {
		app_version: crate::models::APP_VERSION.to_string(),
		os: os_name(),
		cpu: cpu_brand(),
		arch: std::env::consts::ARCH.to_string(),
		ram_bytes: ram_bytes(),
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn collect_populates_stable_fields() {
		let d = collect();
		assert!(!d.app_version.is_empty(), "app version present");
		assert_eq!(d.arch, std::env::consts::ARCH);
		assert!(!d.os.is_empty(), "os name present");
		assert!(!d.cpu.is_empty(), "cpu string present (may be 'unknown')");
	}

	#[cfg(target_os = "macos")]
	#[test]
	fn macos_reports_real_ram_and_os() {
		let d = collect();
		assert!(d.ram_bytes > 0, "macOS should report hw.memsize");
		assert!(d.os.to_lowercase().contains("mac"), "os should look like macOS, got {}", d.os);
	}
}
