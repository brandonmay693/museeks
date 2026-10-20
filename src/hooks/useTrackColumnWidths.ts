import { useEffect, useState, type RefObject } from 'react';
import { create } from 'zustand';

export const TRACK_COLUMNS = [
  'title',
  'rekordbox',
  'bpm',
  'duration',
  'artist',
  'album',
  'genre',
  'finderTags',
] as const;
export type TrackColumn = (typeof TRACK_COLUMNS)[number];
export type TrackColumnWidths = Record<TrackColumn, number>;
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 1200;
const STORAGE_KEY = 'museeks-track-column-widths';

const ORDER_STORAGE_KEY = 'museeks-track-column-order';

export function validateColumnOrder(value: unknown): TrackColumn[] {
  const saved = Array.isArray(value)
    ? value.filter((column): column is TrackColumn =>
        TRACK_COLUMNS.includes(column),
      )
    : [];
  return [...new Set([...saved, ...TRACK_COLUMNS])];
}

function loadOrder(): TrackColumn[] {
  try {
    return validateColumnOrder(
      JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) ?? 'null'),
    );
  } catch {
    return [...TRACK_COLUMNS];
  }
}

const useColumnOrder = create<{
  order: TrackColumn[];
  move: (source: TrackColumn, target: TrackColumn) => void;
}>((set) => ({
  order: loadOrder(),
  move: (source, target) =>
    set(({ order }) => {
      if (source === target) return { order };
      const next = [...order];
      next.splice(order.indexOf(source), 1);
      next.splice(order.indexOf(target), 0, source);
      try {
        localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* Column ordering still works without storage. */
      }
      return { order: next };
    }),
}));

function loadWidths(): Partial<TrackColumnWidths> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{}',
    );
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(
      TRACK_COLUMNS.flatMap((column) => {
        const width = (value as Record<string, unknown>)[column];
        return typeof width === 'number' &&
          Number.isFinite(width) &&
          width >= MIN_COLUMN_WIDTH &&
          width <= MAX_COLUMN_WIDTH
          ? [[column, width]]
          : [];
      }),
    );
  } catch {
    return {};
  }
}

export default function useTrackColumnWidths(
  ref: RefObject<HTMLDivElement | null>,
  showFinderTags: boolean,
  showRekordbox = false,
) {
  const { order, move } = useColumnOrder();
  const [savedWidths, setSavedWidths] = useState(loadWidths);
  const [viewportWidth, setViewportWidth] = useState(900);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setViewportWidth(element.clientWidth),
    );
    observer.observe(element);
    setViewportWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [ref]);

  const metadataWidth = Math.max(
    90,
    Math.round(viewportWidth * (showFinderTags ? 0.15 : 0.2)),
  );
  const defaults: TrackColumnWidths = {
    duration: Math.max(70, Math.round(viewportWidth * 0.07)),
    artist: metadataWidth,
    album: metadataWidth,
    genre: Math.max(
      80,
      Math.round(viewportWidth * (showFinderTags ? 0.1 : 0.2)),
    ),
    finderTags: Math.max(170, Math.round(viewportWidth * 0.22)),
    title: 0,
    rekordbox: 110,
    bpm: 85,
  };
  defaults.title = Math.max(
    120,
    viewportWidth -
      94 -
      (showRekordbox ? defaults.rekordbox + defaults.bpm : 0) -
      defaults.duration -
      defaults.artist -
      defaults.album -
      defaults.genre -
      (showFinderTags ? defaults.finderTags : 0),
  );
  const widths = { ...defaults, ...savedWidths };
  const totalWidth =
    94 +
    widths.title +
    (showRekordbox ? widths.rekordbox + widths.bpm : 0) +
    widths.duration +
    widths.artist +
    widths.album +
    widths.genre +
    (showFinderTags ? widths.finderTags : 0);

  function resize(column: TrackColumn, width: number, commit: boolean) {
    const next = {
      ...widths,
      [column]: Math.max(
        MIN_COLUMN_WIDTH,
        Math.min(MAX_COLUMN_WIDTH, Math.round(width)),
      ),
    };
    setSavedWidths(next);
    if (commit) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* Resizing still works when storage is unavailable. */
      }
    }
  }

  function reset(column: TrackColumn) {
    resize(column, defaults[column], true);
  }

  return { widths, totalWidth, resize, reset, order, move };
}
