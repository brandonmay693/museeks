/**
 * Small utility to display time metrics with a log message
 */
use log::info;
use std::path::{Path, PathBuf};
use std::{ffi::OsStr, time::Instant};
use tauri::Theme;
use walkdir::WalkDir;

use crate::plugins::config::SYSTEM_THEME;

/**
 * Small helper to compute the execution time of some code
 */
pub struct TimeLogger {
    start_time: Instant,
    message: String,
}

impl TimeLogger {
    pub fn new(message: String) -> Self {
        TimeLogger {
            start_time: Instant::now(),
            message,
        }
    }

    pub fn complete(&self) {
        let duration = self.start_time.elapsed();
        info!("{} ({:.2?})", self.message, duration);
    }
}

/**
 * Check if a directory or a file is visible or not, by checking if it start
 * with a dot
 */
fn is_dir_visible(entry: &walkdir::DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| !s.starts_with("."))
        .unwrap_or(false)
}

/**
 * Take an entry and filter out non-allowed extensions
 */
pub fn is_file_valid(path: &Path, allowed_extensions: &[&str]) -> bool {
    let extension = path.extension().and_then(OsStr::to_str).unwrap_or("");
    allowed_extensions
        .iter()
        .any(|allowed| extension.eq_ignore_ascii_case(allowed))
}

/**
 * Scan multiple directories and filter files by extension
 */
pub fn scan_dirs(paths: &[PathBuf], allowed_extensions: &[&str]) -> Vec<PathBuf> {
    paths
        .iter()
        .flat_map(|path| scan_dir(path, allowed_extensions))
        .collect()
}

/**
 * Scan directory and filter files by extension
 */
pub fn scan_dir(path: &PathBuf, allowed_extensions: &[&str]) -> Vec<PathBuf> {
    WalkDir::new(path)
        .follow_links(true)
        .into_iter()
        .filter_entry(is_dir_visible)
        .filter_map(Result::ok)
        .map(|entry| entry.into_path())
        .filter(|path| is_file_valid(path, allowed_extensions))
        .collect()
}

/**
 * Give an arbitrary string (usually the theme value from the config), returns
 * a Tauri theme
 */
pub fn get_theme_from_name(theme_name: &str) -> Option<Theme> {
    match theme_name {
        "light" => Some(Theme::Light),
        "dark" => Some(Theme::Dark),
        SYSTEM_THEME => None,
        _ => None, // ? :]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::libs::database::{SUPPORTED_PLAYLISTS_EXTENSIONS, SUPPORTED_TRACKS_EXTENSIONS};

    #[test]
    fn accepts_supported_extensions_regardless_of_case() {
        for extension in SUPPORTED_TRACKS_EXTENSIONS {
            for extension in [extension.to_string(), extension.to_ascii_uppercase()] {
                assert!(is_file_valid(
                    Path::new(&format!("/Music/Album/Track.{extension}")),
                    &SUPPORTED_TRACKS_EXTENSIONS
                ));
            }
        }
        assert!(is_file_valid(
            Path::new("Track.FlAc"),
            &SUPPORTED_TRACKS_EXTENSIONS
        ));
        assert!(is_file_valid(
            Path::new("Set.M3U"),
            &SUPPORTED_PLAYLISTS_EXTENSIONS
        ));
    }

    #[test]
    fn rejects_missing_or_unsupported_extensions() {
        for filename in ["Track", "Track.", "Track.TXT", "Track.MP3.backup", ".MP3"] {
            assert!(!is_file_valid(
                Path::new(filename),
                &SUPPORTED_TRACKS_EXTENSIONS
            ));
        }
    }

    #[test]
    fn scan_keeps_original_paths_for_mixed_case_extensions() {
        let directory = std::env::temp_dir().join(format!("museeks-scan-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let filenames = ["First.MP3", "Second.FlAc", "Third.wav"];
        for filename in filenames.iter().chain(["Notes.TXT"].iter()) {
            std::fs::write(directory.join(filename), b"fixture").unwrap();
        }
        let mut actual = scan_dir(&directory, &SUPPORTED_TRACKS_EXTENSIONS);
        let mut expected: Vec<PathBuf> = filenames.iter().map(|name| directory.join(name)).collect();
        actual.sort();
        expected.sort();
        std::fs::remove_dir_all(&directory).unwrap();
        assert_eq!(actual, expected);
    }
}
