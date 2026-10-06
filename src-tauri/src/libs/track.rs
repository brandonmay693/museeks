use lofty::config::{ParseOptions, ParsingMode};
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::{Accessor, ItemKey};
use log::warn;
use rayon::iter::IntoParallelRefIterator;
use rayon::iter::ParallelIterator;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::path::PathBuf;
use ts_rs::TS;
use uuid::Uuid;

use crate::libs::database::SUPPORTED_TRACKS_EXTENSIONS;
use crate::libs::error::{AnyResult, MuseeksError};
use crate::libs::utils::is_file_valid;

/**
 * Track
 * represent a single track, id and path should be unique
 */
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
pub struct Track {
    pub id: String,
    pub path: String, // must be unique, ideally, a PathBuf
    pub title: String,
    pub album: String,
    pub album_artist: String,
    #[sqlx(json)]
    pub artists: Vec<String>, // JSON
    #[sqlx(json)]
    pub genres: Vec<String>, // JSON
    pub year: Option<u16>,
    pub duration: u32,
    pub track_no: Option<u32>,
    pub track_of: Option<u32>,
    pub disk_no: Option<u32>,
    pub disk_of: Option<u32>,
    pub is_compilation: bool,
}

/**
 * Represents a group of tracks, grouped by "something", lib artist name, or
 * album name
 */
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
pub struct TrackGroup {
    pub label: String,
    pub genres: Vec<String>,
    pub duration: u32,
    pub year: Option<u16>,
    pub tracks: Vec<Track>,
}

/**
 * Generate a Track struct from a Path, or nothing if it is not a valid audio
 * file
 */
pub fn get_track_from_file(path: &PathBuf) -> AnyResult<Track> {
    match Probe::open(path)
        .map_err(lofty::error::LoftyError::from)
        .and_then(|p| {
            p.options(
                ParseOptions::new()
                    .read_cover_art(false)
                    .parsing_mode(ParsingMode::Relaxed),
            )
            .read()
        })
    {
        Ok(tagged_file) => {
            // Metadata is optional. Use secondary tags (e.g. WAV INFO), then
            // existing filename/unknown fallbacks for otherwise playable files.
            let empty_tag = lofty::tag::Tag::new(tagged_file.primary_tag_type());
            let tag = tagged_file
                .primary_tag()
                .or_else(|| tagged_file.first_tag())
                .unwrap_or(&empty_tag);

            // Lots of tags are missing eaither TrackArtist or AlbumArtist, so instead
            // of being correct, we'll swap them if needed.
            // IMPROVE ME: Is there a more idiomatic way of doing the following?
            let mut artists: Vec<String> = tag
                .get_strings(ItemKey::TrackArtist)
                .map(ToString::to_string)
                .filter(|s| !s.is_empty())
                .collect();

            if artists.is_empty() {
                artists = tag
                    .get_strings(ItemKey::AlbumArtist)
                    .map(ToString::to_string)
                    .filter(|s| !s.is_empty())
                    .collect();
            }

            if artists.is_empty() {
                artists = vec!["Unknown Artist".into()];
            }

            // Try AlbumArtist, fallback to first artist, then to "Unknown Artist"
            let album_artist = tag
                .get_string(ItemKey::AlbumArtist)
                .map(ToString::to_string)
                .or_else(|| artists.first().cloned())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "Unknown Artist".to_string());

            let id = get_track_id_for_path(path)?;

            let is_compilation = tag
                .get_string(ItemKey::FlagCompilation)
                .map_or(false, |v| v == "1" || v.eq_ignore_ascii_case("true"));

            Ok(Track {
                id,
                path: path.to_string_lossy().into_owned(),
                title: tag
                    .get_string(ItemKey::TrackTitle)
                    .filter(|s| !s.is_empty())
                    .map(ToString::to_string)
                    .unwrap_or_else(|| {
                        path.file_name()
                            .and_then(|f| f.to_str())
                            .unwrap_or("Unknown")
                            .to_string()
                    }),
                album: tag
                    .get_string(ItemKey::AlbumTitle)
                    .filter(|s| !s.is_empty())
                    .map(ToString::to_string)
                    .unwrap_or_else(|| "Unknown".to_string()),
                album_artist,
                artists,
                genres: tag
                    .get_strings(ItemKey::Genre)
                    .map(ToString::to_string)
                    .filter(|s| !s.is_empty())
                    .collect(),
                year: tag.date().map(|d| d.year),
                duration: u32::try_from(tagged_file.properties().duration().as_secs()).unwrap_or(0),
                track_no: tag.track(),
                track_of: tag.track_total(),
                disk_no: tag.disk(),
                disk_of: tag.disk_total(),
                is_compilation,
            })
        }
        Err(err) => {
            warn!("Failed to get ID3 tags: \"{}\". File {:?}", err, path);
            Err(MuseeksError::Lofty(err))
        }
    }
}

/**
 * Generate an ID for a track based on its location.
 *
 * We leverage UUID v3 on tracks paths to easily retrieve tracks by path.
 * This is not great and ideally we should use a DB view instead. One day.
 */
pub fn get_track_id_for_path(path: &PathBuf) -> AnyResult<String> {
    match std::fs::canonicalize(path) {
        Ok(canonicalized_path) => Ok(Uuid::new_v3(
            &Uuid::NAMESPACE_OID,
            canonicalized_path.to_string_lossy().as_bytes(),
        )
        .to_string()),
        Err(err) => {
            warn!(r#"ID could not be generated for path {:?}: {}"#, path, err);
            Err(MuseeksError::IDGeneration(path.clone()))
        }
    }
}

/**
 * Given a list of files, return a potential list of tracks
 */
pub fn get_tracks_from_paths(mut files: Vec<PathBuf>) -> Vec<AnyResult<Track>> {
    files.retain(|path| is_file_valid(path, &SUPPORTED_TRACKS_EXTENSIONS));

    // Build a list of tracks, without importing them to the library
    files
        .par_iter()
        .map(get_track_from_file)
        .collect::<Vec<_>>()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wav_fixture(with_invalid_date: bool) -> Vec<u8> {
        let mut chunks = Vec::new();
        chunks.extend_from_slice(b"fmt \x10\0\0\0\x01\0\x01\0");
        chunks.extend_from_slice(&44100_u32.to_le_bytes());
        chunks.extend_from_slice(&88200_u32.to_le_bytes());
        chunks.extend_from_slice(b"\x02\0\x10\0data");
        chunks.extend_from_slice(&88200_u32.to_le_bytes());
        chunks.resize(chunks.len() + 88200, 0);

        if with_invalid_date {
            let mut frames = Vec::new();
            for (id, text) in [(b"TIT2", "Test title"), (b"TDRC", "not-a-date")] {
                frames.extend_from_slice(id);
                // These small ID3v2.4 frame sizes fit in one sync-safe byte.
                frames.extend_from_slice(&[0, 0, 0, (text.len() + 1) as u8, 0, 0, 3]);
                frames.extend_from_slice(text.as_bytes());
            }
            let mut tag = b"ID3\x04\0\0\0\0\0".to_vec();
            tag.push(frames.len() as u8);
            tag.extend(frames);
            chunks.extend_from_slice(b"id3 ");
            chunks.extend_from_slice(&(tag.len() as u32).to_le_bytes());
            chunks.extend(&tag);
            if tag.len() % 2 != 0 {
                chunks.push(0);
            }
        }

        let mut file = b"RIFF".to_vec();
        file.extend_from_slice(&((chunks.len() + 4) as u32).to_le_bytes());
        file.extend_from_slice(b"WAVE");
        file.extend(chunks);
        file
    }

    #[test]
    fn imports_audio_without_tags_and_with_malformed_dates() {
        for invalid_date in [false, true] {
            let path = std::env::temp_dir().join(format!("museeks-{}.WAV", uuid::Uuid::new_v4()));
            std::fs::write(&path, wav_fixture(invalid_date)).unwrap();
            let result = get_track_from_file(&path);
            std::fs::remove_file(&path).unwrap();
            let track = result.unwrap();
            assert_eq!(track.duration, 1);
            if invalid_date {
                assert_eq!(track.title, "Test title");
                assert_eq!(track.year, None);
            } else {
                assert_eq!(track.title, path.file_name().unwrap().to_str().unwrap());
                assert_eq!(track.artists, vec!["Unknown Artist"]);
            }
        }
    }

    #[test]
    fn still_rejects_non_audio_files_with_audio_extensions() {
        let path = std::env::temp_dir().join(format!("museeks-{}.wav", uuid::Uuid::new_v4()));
        std::fs::write(&path, b"not an audio file").unwrap();
        let result = get_track_from_file(&path);
        std::fs::remove_file(&path).unwrap();
        assert!(result.is_err());
    }

    #[test]
    #[ignore = "Read-only diagnostic; set MUSEEKS_IMPORT_FOLDER to a music folder"]
    fn inspect_import_folder() {
        let folder = PathBuf::from(std::env::var("MUSEEKS_IMPORT_FOLDER").unwrap());
        let paths = crate::libs::utils::scan_dir(&folder, &SUPPORTED_TRACKS_EXTENSIONS);
        let mut failures = Vec::new();
        for path in &paths {
            match get_track_from_file(path) {
                Ok(track) => println!("OK {}s {}", track.duration, path.display()),
                Err(error) => failures.push(format!("{}: {}", path.display(), error)),
            }
        }
        println!("{} candidates, {} failures", paths.len(), failures.len());
        assert!(failures.is_empty(), "{}", failures.join("\n"));
    }
}
