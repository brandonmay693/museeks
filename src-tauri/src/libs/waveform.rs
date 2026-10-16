use serde::{Deserialize, Serialize};
use std::{fs, path::Path};
use symphonia::core::{audio::SampleBuffer, errors::Error, io::MediaSourceStream, probe::Hint};
use ts_rs::TS;

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
pub struct Waveform {
    pub duration: f64,
    pub peaks: Vec<f32>,
}

pub fn decode(path: &Path) -> Result<Waveform, String> {
    let source = MediaSourceStream::new(
        Box::new(fs::File::open(path).map_err(|e| e.to_string())?),
        Default::default(),
    );
    let mut hint = Hint::new();
    if let Some(extension) = path.extension().and_then(|s| s.to_str()) {
        hint.with_extension(extension);
    }
    let mut format = symphonia::default::get_probe()
        .format(&hint, source, &Default::default(), &Default::default())
        .map_err(|e| e.to_string())?
        .format;
    let track = format.default_track().ok_or("No audio track")?;
    let id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &Default::default())
        .map_err(|e| e.to_string())?;
    let mut rate = 0;
    let mut frames = 0_u64;
    let mut count = 0_u32;
    let mut sum = 0_f64;
    let mut buckets = Vec::new();
    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(Error::IoError(error)) if error.kind() == std::io::ErrorKind::UnexpectedEof => {
                break;
            }
            Err(error) => return Err(error.to_string()),
        };
        if packet.track_id() != id {
            continue;
        }
        let decoded = decoder.decode(&packet).map_err(|e| e.to_string())?;
        let spec = *decoded.spec();
        if rate != 0 && rate != spec.rate {
            return Err("Changing sample rate is unsupported".into());
        }
        rate = spec.rate;
        let channels = spec.channels.count();
        if rate == 0 || channels == 0 {
            return Err("Invalid audio format".into());
        }
        let mut samples = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        samples.copy_interleaved_ref(decoded);
        for frame in samples.samples().chunks_exact(channels) {
            sum += frame
                .iter()
                .map(|sample| {
                    let value = if sample.is_finite() {
                        sample.clamp(-1.0, 1.0) as f64
                    } else {
                        0.0
                    };
                    value * value
                })
                .sum::<f64>()
                / channels as f64;
            count += 1;
            frames += 1;
            if count >= (rate / 50).max(1) {
                buckets.push((sum / count as f64) as f32);
                sum = 0.0;
                count = 0;
                if buckets.len() > 1_000_000 {
                    return Err("Audio is too long to analyze".into());
                }
            }
        }
    }
    if count > 0 {
        buckets.push((sum / count as f64) as f32);
    }
    if frames == 0 {
        return Err("No decodable audio samples".into());
    }
    Ok(Waveform {
        duration: frames as f64 / rate as f64,
        peaks: summarize(&buckets, 768),
    })
}

fn summarize(buckets: &[f32], resolution: usize) -> Vec<f32> {
    let size = resolution.min(buckets.len());
    let mut peaks: Vec<f32> = (0..size)
        .map(|index| {
            let start = index * buckets.len() / size;
            let end = (index + 1) * buckets.len() / size;
            // RMS envelope exposes changes in loudness even in heavily limited tracks.
            (buckets[start..end].iter().sum::<f32>() / (end - start) as f32).sqrt()
        })
        .collect();
    let max = peaks.iter().copied().fold(0.0_f32, f32::max);
    if max > 0.0 {
        for peak in &mut peaks {
            *peak /= max;
        }
    }
    peaks
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn envelope_preserves_silence_and_loudness_changes() {
        assert_eq!(
            summarize(&[0.0, 0.0, 0.25, 0.25, 1.0, 1.0], 3),
            vec![0.0, 0.5, 1.0]
        );
        assert_eq!(summarize(&[0.0; 10], 3), vec![0.0; 3]);
        assert!(summarize(&[], 3).is_empty());
    }
    #[test]
    fn decodes_real_audio_fixture() {
        let waveform = decode(Path::new("../src/__tests__/assets/whiskey-blues.mp3")).unwrap();
        assert!(waveform.duration > 1.0);
        assert_eq!(waveform.peaks.len(), 768);
        assert!(
            waveform
                .peaks
                .iter()
                .all(|p| p.is_finite() && *p >= 0.0 && *p <= 1.0)
        );
    }
}
