import type {
  RekordboxSnapshot,
  RekordboxTrack,
  Track,
} from '../generated/typings';

// Camelot positions by chromatic pitch class, starting at C.
const MAJOR = [
  '8B',
  '3B',
  '10B',
  '5B',
  '12B',
  '7B',
  '2B',
  '9B',
  '4B',
  '11B',
  '6B',
  '1B',
];
const MINOR = [
  '5A',
  '12A',
  '7A',
  '2A',
  '9A',
  '4A',
  '11A',
  '6A',
  '1A',
  '8A',
  '3A',
  '10A',
];
const PITCHES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function camelotKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().replaceAll('♯', '#').replaceAll('♭', 'b');
  const camelot = /^(1[0-2]|[1-9])([ab])$/i.exec(key);
  if (camelot) return `${camelot[1]}${camelot[2].toUpperCase()}`;
  const musical = /^([A-Ga-g])([#b]?)(?:\s*(m|min|minor|maj|major))?$/.exec(
    key,
  );
  if (!musical) return null;
  const pitch =
    (PITCHES[musical[1].toUpperCase()] +
      (musical[2] === '#' ? 1 : musical[2] === 'b' ? -1 : 0) +
      12) %
    12;
  const minor = ['m', 'min', 'minor'].includes(musical[3]);
  return (minor ? MINOR : MAJOR)[pitch];
}

export function compatibleKeys(
  key: string | null,
  adventurous = false,
): string[] {
  const normalized = camelotKey(key);
  if (!normalized) return [];
  const number = Number(normalized.slice(0, -1));
  const letter = normalized.slice(-1);
  const at = (offset: number) =>
    `${((number - 1 + offset + 12) % 12) + 1}${letter}`;
  const standard = [
    normalized,
    at(-1),
    at(1),
    `${number}${letter === 'A' ? 'B' : 'A'}`,
  ];
  // Optional energy-boost experiments: +2 (whole tone) and +7 (semitone).
  return adventurous ? [...standard, at(2), at(7)] : standard;
}

export function rekordboxByPath(
  snapshot: RekordboxSnapshot | null | undefined,
): Record<string, RekordboxTrack> {
  return Object.fromEntries(
    Object.entries(snapshot?.tracks ?? {}).map(([path, data]) => [
      path.normalize('NFC'),
      data,
    ]),
  );
}

export function trackRekordbox(
  track: Track,
  entries: Record<string, RekordboxTrack>,
): RekordboxTrack | undefined {
  return entries[track.path.normalize('NFC')];
}

export function harmonicMatches(
  tracks: Track[],
  reference: Track,
  entries: Record<string, RekordboxTrack>,
  adventurous = false,
): Track[] {
  const keys = new Set(
    compatibleKeys(
      trackRekordbox(reference, entries)?.key ?? null,
      adventurous,
    ),
  );
  return tracks.filter(
    (track) =>
      track.id !== reference.id &&
      keys.has(camelotKey(trackRekordbox(track, entries)?.key) ?? ''),
  );
}

export type HarmonicSearch = {
  match?: string;
  matchSearch?: string;
  matchGenre?: string[];
  matchEnergy?: number | 'untagged';
  matchNeedsTagging?: boolean;
  adventurous?: boolean;
  matchOrder?: 'Asc' | 'Dsc';
  matchSortBy?: 'Energy' | 'Bpm';
};
