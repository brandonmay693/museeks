import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { useId, useMemo } from 'react';

import type { Track } from '../generated/typings';
import {
  usePlayingTrack,
  usePlayingTrackCurrentTime,
} from '../hooks/usePlayer';
import WaveformBridge from '../lib/bridge-waveform';
import player from '../lib/player';
import { logAndNotifyError } from '../lib/utils';

type Props = { track: Track; reference?: boolean };

// Shared between both waveforms so a slow track load cannot undo a newer seek.
let latestSeek = 0;

export default function TrackWaveform({ track, reference = false }: Props) {
  const { t } = useLingui();
  const current = usePlayingTrack();
  const elapsed = usePlayingTrackCurrentTime();
  const active = current?.id === track.id;
  const waveform = useQuery({
    queryKey: ['waveform', track.path],
    queryFn: () => WaveformBridge.get(track.path),
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
  });
  const duration = waveform.data?.duration ?? track.duration;
  const position = active ? Math.min(elapsed, duration) : 0;
  const progress = duration > 0 ? position / duration : 0;
  const clip = useId();
  const shape = useMemo(() => {
    const peaks = waveform.data?.peaks;
    if (!peaks?.length) return '';
    const top = peaks
      .map((peak, index) => `${(index * 768) / peaks.length},${50 - peak * 46}`)
      .join(' L');
    const bottom = peaks
      .map((peak, index) => `${(index * 768) / peaks.length},${50 + peak * 46}`)
      .reverse()
      .join(' L');
    return `M0,50 L${top} L768,50 L${bottom} Z`;
  }, [waveform.data]);

  async function seek(time: number) {
    const request = ++latestSeek;
    const target = Math.max(0, Math.min(time, Math.max(0, duration - 0.05)));
    if (player.getTrack()?.id !== track.id) {
      await player.start([track], track.id, { type: 'library' });
    }
    // A newer selection may have taken over while playback was loading.
    if (request === latestSeek && player.getTrack()?.id === track.id) {
      player.setCurrentTime(target);
    }
  }

  function jump(offset: number) {
    const from =
      player.getTrack()?.id === track.id ? player.getCurrentTime() : 0;
    void seek(from + offset).catch(logAndNotifyError);
  }

  const label = reference ? t`Seek reference track` : t`Seek playing track`;
  const status = waveform.isPending
    ? t`Loading waveform…`
    : waveform.isError
      ? t`Waveform unavailable · seeking still works`
      : null;

  return (
    <div {...stylex.props(styles.container)}>
      <button
        type="button"
        title={t`Back 10 seconds`}
        aria-label={t`Back 10 seconds`}
        disabled={duration <= 0}
        onClick={() => jump(-10)}
        {...stylex.props(styles.jump)}
      >
        −10
      </button>
      <div
        {...stylex.props(styles.wave)}
        title={status ?? t`Click or drag to seek`}
      >
        <svg
          viewBox="0 0 768 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          {...stylex.props(styles.svg)}
        >
          <defs>
            <clipPath id={clip}>
              <rect width={progress * 768} height="100" />
            </clipPath>
          </defs>
          <line
            x1="0"
            x2="768"
            y1="50"
            y2="50"
            stroke="var(--text-muted)"
            opacity="0.3"
          />
          <path d={shape} fill="var(--text-muted)" opacity="0.65" />
          <path d={shape} fill="var(--main-color)" clipPath={`url(#${clip})`} />
          <line
            x1={progress * 768}
            x2={progress * 768}
            y1="0"
            y2="100"
            stroke="var(--main-color)"
            strokeWidth="2"
          />
        </svg>
        {status && <span {...stylex.props(styles.status)}>{status}</span>}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={position}
          disabled={duration <= 0}
          aria-label={label}
          aria-valuetext={`${Math.floor(position / 60)}:${String(Math.floor(position % 60)).padStart(2, '0')}`}
          onChange={(event) =>
            void seek(Number(event.target.value)).catch(logAndNotifyError)
          }
          {...stylex.props(styles.seek)}
        />
      </div>
      <button
        type="button"
        title={t`Forward 10 seconds`}
        aria-label={t`Forward 10 seconds`}
        disabled={duration <= 0}
        onClick={() => jump(10)}
        {...stylex.props(styles.jump)}
      >
        +10
      </button>
    </div>
  );
}

const styles = stylex.create({
  container: {
    display: 'flex',
    alignItems: 'center',
    columnGap: '4px',
    minWidth: 0,
    width: '100%',
  },
  wave: {
    position: 'relative',
    flexGrow: 1,
    minWidth: 0,
    height: '34px',
    borderRadius: '3px',
    backgroundColor: 'var(--header-bg)',
    overflow: 'hidden',
    outline: { ':focus-within': '2px solid var(--main-color)' },
  },
  svg: { width: '100%', height: '100%', display: 'block' },
  seek: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    opacity: 0,
    cursor: 'crosshair',
    touchAction: 'none',
  },
  status: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  jump: {
    flexShrink: 0,
    fontSize: '10px',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--main-color)',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    padding: '3px',
    cursor: 'pointer',
  },
});
