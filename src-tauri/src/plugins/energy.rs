use tauri::Runtime;
use tauri::plugin::{Builder, TauriPlugin};

const GENRES: &[&str] = &[
    "House",
    "Deep House",
    "Tech House",
    "Minimal / Deep Tech",
    "Afro House",
    "Amapiano",
    "Gqom",
    "Progressive House",
    "Bass House",
    "Disco / Nu Disco",
    "Techno",
    "Trance",
    "UK Garage",
    "Breaks",
    "Drum & Bass",
    "Dubstep",
    "Ambient",
    "Hip-Hop",
    "R&B",
];

fn genre_name(tag: &str) -> Option<&str> {
    tag.split('\n')
        .next()?
        .strip_prefix("Museeks Genre ")
        .filter(|genre| !genre.is_empty())
}

fn replace_genre(tags: Vec<String>, genre: Option<&str>) -> Vec<String> {
    let mut tags: Vec<String> = tags
        .into_iter()
        .filter(|tag| genre_name(tag).is_none())
        .collect();
    if let Some(genre) = genre {
        tags.push(format!("Museeks Genre {}\n0", genre));
    }
    tags
}

#[tauri::command]
fn get_genres() -> Vec<&'static str> {
    GENRES.to_vec()
}

#[tauri::command]
async fn get_genre(path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = TAG_LOCK.lock().map_err(|error| error.to_string())?;
        Ok(finder_tags(&path, None)?
            .iter()
            .find_map(|tag| genre_name(tag).map(str::to_string)))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn set_genre(path: String, genre: Option<String>) -> Result<(), String> {
    if genre
        .as_deref()
        .is_some_and(|genre| !GENRES.contains(&genre))
    {
        return Err("Choose a genre from the list".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        // Use the same lock as energy updates so neither overwrites the other.
        let _guard = TAG_LOCK.lock().map_err(|error| error.to_string())?;
        let tags = replace_genre(finder_tags(&path, None)?, genre.as_deref());
        if finder_tags(&path, Some(&tags))? != tags {
            return Err("The drive did not preserve the Finder tags".into());
        }
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn energy_level(tag: &str) -> Option<u8> {
    // Finder stores an optional color number after a newline.
    let tag = tag.split('\n').next()?;
    (1..=10).find(|level| tag == format!("Museeks Energy {:02}", level))
}

fn replace_energy(tags: Vec<String>, level: Option<u8>) -> Vec<String> {
    let mut tags: Vec<String> = tags
        .into_iter()
        .filter(|tag| energy_level(tag).is_none())
        .collect();
    if let Some(level) = level {
        tags.push(format!("Museeks Energy {:02}\n0", level));
    }
    tags
}

#[cfg(target_os = "macos")]
fn finder_tags(path: &str, tags: Option<&[String]>) -> Result<Vec<String>, String> {
    let path = std::fs::canonicalize(path).map_err(|error| error.to_string())?;
    if !path.is_file() {
        return Err("The track is not a file".into());
    }
    const ATTRIBUTE: &str = "com.apple.metadata:_kMDItemUserTags";
    let run = |args: &[&str]| -> Result<Vec<u8>, String> {
        // Separate arguments protect filenames containing quotes or shell syntax.
        let output = std::process::Command::new("/usr/bin/xattr")
            .args(args)
            .arg(&path)
            .output()
            .map_err(|error| error.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        Ok(output.stdout)
    };
    if let Some(tags) = tags {
        // Keep the complete strings, including other tags' Finder colors.
        let mut bytes = Vec::new();
        plist::to_writer_binary(&mut bytes, &tags).map_err(|error| error.to_string())?;
        let hex: String = bytes.iter().map(|byte| format!("{:02x}", byte)).collect();
        run(&["-wx", ATTRIBUTE, &hex])?;
    }
    let attributes = run(&[])?;
    if !String::from_utf8_lossy(&attributes)
        .lines()
        .any(|name| name == ATTRIBUTE)
    {
        return Ok(Vec::new());
    }
    // Hex output avoids xattr's trailing newline altering the binary plist trailer.
    let output = run(&["-px", ATTRIBUTE])?;
    let hex = String::from_utf8(output).map_err(|error| error.to_string())?;
    let bytes: Result<Vec<u8>, _> = hex
        .split_whitespace()
        .map(|byte| u8::from_str_radix(byte, 16))
        .collect();
    let bytes = bytes.map_err(|error| error.to_string())?;
    plist::from_reader(std::io::Cursor::new(bytes)).map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
fn finder_tags(_path: &str, _tags: Option<&[String]>) -> Result<Vec<String>, String> {
    Err("Finder tags are only available on macOS".into())
}

// Serialize read/modify/write operations, including when playback changes mid-save.
static TAG_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[tauri::command]
async fn get_energy(path: String) -> Result<Option<u8>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = TAG_LOCK.lock().map_err(|error| error.to_string())?;
        Ok(finder_tags(&path, None)?
            .iter()
            .find_map(|tag| energy_level(tag)))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn set_energy(path: String, level: Option<u8>) -> Result<(), String> {
    if level.is_some_and(|level| !(1..=10).contains(&level)) {
        return Err("Energy must be between 1 and 10".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = TAG_LOCK.lock().map_err(|error| error.to_string())?;
        let tags = replace_energy(finder_tags(&path, None)?, level);
        let saved = finder_tags(&path, Some(&tags))?;
        if saved != tags {
            return Err("The drive did not preserve the Finder tags".into());
        }
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R>::new("energy")
        .invoke_handler(tauri::generate_handler![
            get_energy, set_energy, get_genres, get_genre, set_genre
        ])
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn genre_changes_preserve_energy_and_other_tags() {
        let tags = vec![
            "Favourite\n6".into(),
            "Museeks Energy 07\n0".into(),
            "Museeks Genre House\n0".into(),
            "Museeks Genre Techno\n0".into(),
        ];
        let updated = replace_genre(tags, Some("Tech House"));
        assert_eq!(
            updated,
            vec![
                "Favourite\n6",
                "Museeks Energy 07\n0",
                "Museeks Genre Tech House\n0",
            ]
        );
        assert_eq!(
            replace_energy(updated.clone(), Some(8)),
            vec![
                "Favourite\n6",
                "Museeks Genre Tech House\n0",
                "Museeks Energy 08\n0"
            ]
        );
        assert_eq!(
            replace_genre(updated, None),
            vec!["Favourite\n6", "Museeks Energy 07\n0"]
        );
        assert_eq!(genre_name("Museeks Genre Custom\n4"), Some("Custom"));
        assert_eq!(genre_name("Genre House"), None);
    }

    #[tokio::test]
    async fn rejects_genres_outside_the_list_before_accessing_files() {
        assert_eq!(
            set_genre("missing.mp3".into(), Some("House\n6".into())).await,
            Err("Choose a genre from the list".into())
        );
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn concurrent_genre_and_energy_updates_preserve_both() {
        let path = std::env::temp_dir().join(format!("museeks-genre-{}.mp3", uuid::Uuid::new_v4()));
        std::fs::write(&path, b"audio content").unwrap();
        let filename = path.to_str().unwrap().to_string();
        finder_tags(&filename, Some(&["Favourite\n6".into()])).unwrap();
        let (genre, energy) = tokio::join!(
            set_genre(filename.clone(), Some("Tech House".into())),
            set_energy(filename.clone(), Some(7)),
        );
        genre.unwrap();
        energy.unwrap();
        assert_eq!(
            get_genre(filename.clone()).await.unwrap(),
            Some("Tech House".into())
        );
        assert_eq!(get_energy(filename.clone()).await.unwrap(), Some(7));
        set_genre(filename.clone(), None).await.unwrap();
        assert_eq!(get_genre(filename.clone()).await.unwrap(), None);
        assert_eq!(get_energy(filename.clone()).await.unwrap(), Some(7));
        assert!(
            finder_tags(&filename, None)
                .unwrap()
                .contains(&"Favourite\n6".into())
        );
        assert_eq!(std::fs::read(&path).unwrap(), b"audio content");
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn replaces_only_owned_tags_and_clears_conflicting_levels() {
        let tags = vec![
            "Favourite\n6".into(),
            "Museeks Energy 03".into(),
            "Museeks Energy 08".into(),
            "Museeks Energy custom".into(),
        ];
        let updated = replace_energy(tags, Some(10));
        assert_eq!(
            updated,
            vec![
                "Favourite\n6",
                "Museeks Energy custom",
                "Museeks Energy 10\n0"
            ]
        );
        assert_eq!(
            replace_energy(updated, None),
            vec!["Favourite\n6", "Museeks Energy custom"]
        );
    }

    #[test]
    fn recognizes_only_exact_energy_tags() {
        for level in 1..=10 {
            assert_eq!(
                energy_level(&format!("Museeks Energy {:02}", level)),
                Some(level)
            );
            assert_eq!(
                energy_level(&format!("Museeks Energy {:02}\n0", level)),
                Some(level)
            );
        }
        for tag in [
            "Museeks Energy 00",
            "Museeks Energy 11",
            "Energy 05",
            "Museeks Energy 5",
        ] {
            assert_eq!(energy_level(tag), None);
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn finder_tags_round_trip_without_changing_audio_or_other_metadata() {
        let path = std::env::temp_dir().join(format!(
            "museeks-energy-{}-'音楽'.mp3",
            uuid::Uuid::new_v4()
        ));
        std::fs::write(&path, b"audio content").unwrap();
        let filename = path.to_str().unwrap();
        assert_eq!(finder_tags(filename, None).unwrap(), Vec::<String>::new());

        let existing = vec!["Favourite\n6".into(), "Warm-up\n2".into()];
        finder_tags(filename, Some(&existing)).unwrap();
        let updated = replace_energy(finder_tags(filename, None).unwrap(), Some(7));
        finder_tags(filename, Some(&updated)).unwrap();
        assert_eq!(finder_tags(filename, None).unwrap(), updated);

        let cleared = replace_energy(finder_tags(filename, None).unwrap(), None);
        finder_tags(filename, Some(&cleared)).unwrap();
        assert_eq!(finder_tags(filename, None).unwrap(), existing);
        assert_eq!(std::fs::read(&path).unwrap(), b"audio content");
        std::fs::remove_file(&path).unwrap();
        assert!(finder_tags(filename, None).is_err());
    }
}
