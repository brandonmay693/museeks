use crate::libs::waveform::{self, Waveform};
use std::{fs, path::Path, time::UNIX_EPOCH};
use tauri::{
    Manager, Runtime,
    plugin::{Builder, TauriPlugin},
};

// Limit expensive decoders to one background worker at a time.
static ANALYSIS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(1);

fn load(path: &Path, cache: &Path) -> Result<Waveform, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    let signature = format!(
        "v1:{}:{}:{}",
        path.display(),
        metadata.len(),
        modified
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
    );
    let key = uuid::Uuid::new_v3(&uuid::Uuid::NAMESPACE_URL, signature.as_bytes());
    let file = cache.join(format!("{key}.json"));
    if let Ok(bytes) = fs::read(&file) {
        if let Ok(waveform) = serde_json::from_slice::<Waveform>(&bytes) {
            if waveform.duration.is_finite()
                && waveform.duration > 0.0
                && !waveform.peaks.is_empty()
                && waveform.peaks.len() <= 768
                && waveform
                    .peaks
                    .iter()
                    .all(|p| p.is_finite() && *p >= 0.0 && *p <= 1.0)
            {
                return Ok(waveform);
            }
        }
    }
    let waveform = waveform::decode(path)?;
    let after = fs::metadata(path).map_err(|e| e.to_string())?;
    if after.len() != metadata.len() || after.modified().ok() != Some(modified) {
        return Err("Audio file changed during waveform analysis".into());
    }
    // Cache failures do not prevent listening or displaying the waveform.
    if fs::create_dir_all(cache).is_ok() {
        if let Ok(bytes) = serde_json::to_vec(&waveform) {
            let _ = fs::write(file, bytes);
        }
    }
    Ok(waveform)
}

#[tauri::command]
async fn get_waveform<R: Runtime>(
    app: tauri::AppHandle<R>,
    path: String,
) -> Result<Waveform, String> {
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("waveforms");
    let permit = ANALYSIS.acquire().await.map_err(|e| e.to_string())?;
    let result = tauri::async_runtime::spawn_blocking(move || load(Path::new(&path), &cache))
        .await
        .map_err(|e| e.to_string())?;
    drop(permit);
    result
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("waveform")
        .invoke_handler(tauri::generate_handler![get_waveform])
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn wav(seconds: u32) -> Vec<u8> {
        let data_len = seconds * 8000 * 2;
        let mut bytes = Vec::new();
        bytes.extend(b"RIFF");
        bytes.extend((36 + data_len).to_le_bytes());
        bytes.extend(b"WAVEfmt ");
        bytes.extend(16_u32.to_le_bytes());
        bytes.extend(1_u16.to_le_bytes());
        bytes.extend(1_u16.to_le_bytes());
        bytes.extend(8000_u32.to_le_bytes());
        bytes.extend(16000_u32.to_le_bytes());
        bytes.extend(2_u16.to_le_bytes());
        bytes.extend(16_u16.to_le_bytes());
        bytes.extend(b"data");
        bytes.extend(data_len.to_le_bytes());
        for i in 0..data_len / 2 {
            bytes.extend(((i % 100) as i16 * 100).to_le_bytes());
        }
        bytes
    }
    #[test]
    fn caches_and_invalidates_changed_audio_and_recovers_corrupt_cache() {
        let root = std::env::temp_dir().join(format!("museeks-waveform-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("track.wav");
        let cache = root.join("cache");
        fs::write(&path, wav(1)).unwrap();
        let first = load(&path, &cache).unwrap();
        assert!((first.duration - 1.0).abs() < 0.01);
        assert_eq!(load(&path, &cache).unwrap().peaks, first.peaks);
        let cached = fs::read_dir(&cache)
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        fs::write(cached, "broken").unwrap();
        assert_eq!(load(&path, &cache).unwrap().peaks, first.peaks);
        fs::write(&path, wav(2)).unwrap();
        assert!((load(&path, &cache).unwrap().duration - 2.0).abs() < 0.01);
        fs::write(&path, "not audio").unwrap();
        assert!(load(&path, &cache).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
