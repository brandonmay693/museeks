use crate::{
    libs::rekordbox::{self, RekordboxSnapshot},
    plugins::config::ConfigManager,
};
use std::{
    fs,
    path::Path,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    Runtime, State,
    plugin::{Builder, TauriPlugin},
};

// XML is read only. A failed refresh never overwrites the last valid client snapshot.
static CACHE: Mutex<Option<(String, SystemTime, u64, RekordboxSnapshot)>> = Mutex::new(None);

fn read_snapshot(path: &str) -> Result<RekordboxSnapshot, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Cannot read Rekordbox export: {e}"))?;
    if !metadata.is_file() || metadata.len() > 100 * 1024 * 1024 {
        return Err("Choose an XML file smaller than 100 MB".into());
    }
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    let mut cache = CACHE.lock().map_err(|e| e.to_string())?;
    if let Some((cached_path, time, size, snapshot)) = cache.as_ref() {
        if cached_path == path && *time == modified && *size == metadata.len() {
            return Ok(snapshot.clone());
        }
    }
    let xml = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let (tracks, skipped) = rekordbox::parse(&xml)?;
    let after = fs::metadata(path).map_err(|e| e.to_string())?;
    if after.modified().ok() != Some(modified) || after.len() != metadata.len() {
        return Err("Rekordbox export is being updated. Try refreshing again.".into());
    }
    let snapshot = RekordboxSnapshot {
        source: path.to_owned(),
        modified_ms: modified
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis() as u64,
        tracks,
        skipped,
    };
    *cache = Some((path.to_owned(), modified, metadata.len(), snapshot.clone()));
    Ok(snapshot)
}

#[tauri::command]
async fn get_snapshot(
    config: State<'_, ConfigManager>,
) -> Result<Option<RekordboxSnapshot>, String> {
    let path = config.get().map_err(|e| e.to_string())?.rekordbox_xml_path;
    tauri::async_runtime::spawn_blocking(move || path.map(|path| read_snapshot(&path)).transpose())
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn set_source(
    config: State<'_, ConfigManager>,
    path: String,
) -> Result<RekordboxSnapshot, String> {
    let path = rekordbox::normalize_path(Path::new(&path));
    let snapshot = tauri::async_runtime::spawn_blocking(move || read_snapshot(&path))
        .await
        .map_err(|e| e.to_string())??;
    let mut settings = config.get().map_err(|e| e.to_string())?;
    settings.rekordbox_xml_path = Some(snapshot.source.clone());
    config.update(settings).map_err(|e| e.to_string())?;
    Ok(snapshot)
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("rekordbox")
        .invoke_handler(tauri::generate_handler![get_snapshot, set_source])
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refreshes_changed_exports_and_rejects_broken_replacements() {
        let path = std::env::temp_dir().join(format!("museeks-rb-{}.xml", std::process::id()));
        let source = path.to_str().unwrap();
        fs::write(&path, r#"<DJ_PLAYLISTS><COLLECTION><TRACK Location="file://localhost/music/a.mp3" Tonality="Am"/></COLLECTION></DJ_PLAYLISTS>"#).unwrap();
        let first = read_snapshot(source).unwrap();
        assert_eq!(first.tracks["/music/a.mp3"].key.as_deref(), Some("Am"));
        assert_eq!(
            read_snapshot(source).unwrap().modified_ms,
            first.modified_ms
        );
        fs::write(&path, r#"<DJ_PLAYLISTS><COLLECTION><TRACK Location="file://localhost/music/a.mp3" Tonality="F#m"/></COLLECTION></DJ_PLAYLISTS>"#).unwrap();
        assert_eq!(
            read_snapshot(source).unwrap().tracks["/music/a.mp3"]
                .key
                .as_deref(),
            Some("F#m")
        );
        fs::write(&path, "<DJ_PLAYLISTS>").unwrap();
        assert!(read_snapshot(source).is_err());
        fs::remove_file(&path).unwrap();
        assert!(read_snapshot(source).is_err());
    }

    #[test]
    #[ignore = "requires a local user export"]
    fn validates_local_export() {
        let path = std::env::var("MUSEEKS_REKORDBOX_XML").unwrap();
        let snapshot = read_snapshot(&path).unwrap();
        assert!(!snapshot.tracks.is_empty());
        println!(
            "Parsed {} files, {} with keys, {} skipped",
            snapshot.tracks.len(),
            snapshot
                .tracks
                .values()
                .filter(|track| track.key.is_some())
                .count(),
            snapshot.skipped
        );
    }
}
