use std::{collections::HashMap, path::Path};

use quick_xml::{Reader, events::Event};
use serde::Serialize;
use ts_rs::TS;
use url::Url;

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
pub struct RekordboxTrack {
    pub key: Option<String>,
    pub bpm: Option<f64>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
pub struct RekordboxSnapshot {
    pub source: String,
    #[ts(type = "number")]
    pub modified_ms: u64,
    pub tracks: HashMap<String, RekordboxTrack>,
    pub skipped: usize,
}

pub fn normalize_path(path: &Path) -> String {
    path.canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .into_owned()
}

pub fn parse(xml: &str) -> Result<(HashMap<String, RekordboxTrack>, usize), String> {
    let mut reader = Reader::from_str(xml);
    let mut stack: Vec<Vec<u8>> = Vec::new();
    let mut tracks = HashMap::new();
    let mut skipped = 0;
    let mut collection = false;
    let mut root = false;
    loop {
        let event = reader
            .read_event()
            .map_err(|e| format!("Invalid Rekordbox XML: {e}"))?;
        match &event {
            Event::Start(element) | Event::Empty(element) => {
                let name = element.name();
                if stack.is_empty() {
                    if root || name.as_ref() != b"DJ_PLAYLISTS" {
                        return Err("Expected a Rekordbox DJ_PLAYLISTS export".into());
                    }
                    root = true;
                }
                if stack.len() == 1 && name.as_ref() == b"COLLECTION" {
                    collection = true;
                }
                if stack.len() == 2 && stack[1] == b"COLLECTION" && name.as_ref() == b"TRACK" {
                    let mut location = None;
                    let mut key = None;
                    let mut bpm = None;
                    for attribute in element.attributes() {
                        let attribute = attribute.map_err(|e| e.to_string())?;
                        let value = attribute
                            .decode_and_unescape_value(reader.decoder())
                            .map_err(|e| e.to_string())?;
                        match attribute.key.as_ref() {
                            b"Location" => location = Some(value.into_owned()),
                            b"Tonality" => {
                                key = (!value.trim().is_empty()).then(|| value.trim().to_owned())
                            }
                            b"AverageBpm" => {
                                bpm = value
                                    .parse::<f64>()
                                    .ok()
                                    .filter(|n| n.is_finite() && *n > 0.0)
                            }
                            _ => {}
                        }
                    }
                    let path = location
                        .and_then(|value| Url::parse(&value).ok())
                        .and_then(|url| url.to_file_path().ok());
                    if let Some(path) = path {
                        let path = normalize_path(&path);
                        // Multiple entries for one file must not silently select conflicting keys.
                        tracks
                            .entry(path)
                            .and_modify(|old: &mut RekordboxTrack| {
                                if old.key != key {
                                    old.key = None;
                                }
                                if old.bpm != bpm {
                                    old.bpm = None;
                                }
                            })
                            .or_insert(RekordboxTrack { key, bpm });
                    } else {
                        skipped += 1;
                    }
                }
            }
            Event::DocType(_) => return Err("DOCTYPE is not supported in Rekordbox exports".into()),
            Event::Eof => break,
            _ => {}
        }
        match event {
            Event::Start(element) => stack.push(element.name().as_ref().to_vec()),
            Event::End(_) => {
                stack.pop();
            }
            _ => {}
        }
    }
    if !root || !collection || !stack.is_empty() {
        return Err("Incomplete Rekordbox collection XML".into());
    }
    Ok((tracks, skipped))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_collection_only_and_decodes_paths() {
        let xml = r#"<?xml version="1.0"?><DJ_PLAYLISTS><COLLECTION>
          <TRACK Location="file://localhost/tmp/A%20%26%20B%23.flac" Tonality="F#m" AverageBpm="128.5"><TEMPO Bpm="128.5"/></TRACK>
          <TRACK Location="file://localhost/tmp/missing.mp3" Tonality="" AverageBpm="0"/>
          <TRACK Location="https://example.com/audio.mp3" Tonality="Am"/>
        </COLLECTION><PLAYLISTS><NODE><TRACK Key="42"/></NODE></PLAYLISTS></DJ_PLAYLISTS>"#;
        let (tracks, skipped) = parse(xml).unwrap();
        assert_eq!(tracks.len(), 2);
        assert_eq!(skipped, 1);
        assert_eq!(tracks["/tmp/A & B#.flac"].key.as_deref(), Some("F#m"));
        assert_eq!(tracks["/tmp/A & B#.flac"].bpm, Some(128.5));
        assert!(tracks["/tmp/missing.mp3"].key.is_none());
        assert!(tracks["/tmp/missing.mp3"].bpm.is_none());
    }

    #[test]
    fn rejects_wrong_or_incomplete_xml() {
        for xml in [
            "<html/>",
            "<DJ_PLAYLISTS>",
            "<DJ_PLAYLISTS/>",
            "<DJ_PLAYLISTS><COLLECTION><TRACK></COLLECTION></DJ_PLAYLISTS>",
            "<!DOCTYPE x><DJ_PLAYLISTS><COLLECTION/></DJ_PLAYLISTS>",
        ] {
            assert!(parse(xml).is_err(), "Accepted {xml}");
        }
        assert!(parse("<DJ_PLAYLISTS><COLLECTION/></DJ_PLAYLISTS>").is_ok());
    }

    #[test]
    fn conflicting_duplicate_keys_are_unknown() {
        let (tracks, _) = parse(r#"<DJ_PLAYLISTS><COLLECTION><TRACK Location="file://localhost/tmp/a.mp3" Tonality="Am"/><TRACK Location="file://localhost/tmp/a.mp3" Tonality="Cm"/></COLLECTION></DJ_PLAYLISTS>"#).unwrap();
        assert_eq!(tracks.len(), 1);
        assert!(tracks["/tmp/a.mp3"].key.is_none());
    }
}
