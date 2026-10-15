import { describe, expect, test } from 'vite-plus/test';

import type { RekordboxTrack, Track } from '../../generated/typings';
import { camelotKey, compatibleKeys, harmonicMatches } from '../rekordbox';

describe('Rekordbox harmonic matching', () => {
  test.each([
    ['Am', '8A'],
    ['C', '8B'],
    ['F#m', '11A'],
    ['Gbm', '11A'],
    ['Dbm', '12A'],
    ['C#m', '12A'],
    ['Abm', '1A'],
    ['G#m', '1A'],
    ['Bbm', '3A'],
    ['A♯ minor', '3A'],
    ['D♭ major', '3B'],
    ['2a', '2A'],
    ['12B', '12B'],
    ['C major', '8B'],
    ['C minor', '5A'],
    ['G', '9B'],
  ])('normalizes %s to %s', (key, expected) =>
    expect(camelotKey(key)).toBe(expected),
  );
  test.each(['', 'unknown', '13A', '0B', '8m', 'Cdim', 'Am extra'])(
    'rejects unknown key %s',
    (key) => expect(camelotKey(key)).toBeNull(),
  );
  test('wraps adjacent Camelot positions and separates experimental moves', () => {
    expect(compatibleKeys('1A')).toEqual(['1A', '12A', '2A', '1B']);
    expect(compatibleKeys('12B')).toEqual(['12B', '11B', '1B', '12A']);
    expect(compatibleKeys('Am', true)).toEqual([
      '8A',
      '7A',
      '9A',
      '8B',
      '10A',
      '3A',
    ]);
    expect(compatibleKeys(null)).toEqual([]);
  });
  test('matches all compatible keys across the supplied library, excluding self and unknowns', () => {
    const keys = ['Am', 'Dm', 'Em', 'C', 'F#m', null, 'Bm'];
    const tracks = keys.map(
      (_, index) => ({ id: String(index), path: `/music/${index}` }) as Track,
    );
    const entries: Record<string, RekordboxTrack> = Object.fromEntries(
      keys.map((key, index) => [`/music/${index}`, { key, bpm: null }]),
    );
    expect(
      harmonicMatches(tracks, tracks[0], entries).map((track) => track.id),
    ).toEqual(['1', '2', '3']);
    expect(
      harmonicMatches(tracks, tracks[0], entries, true).map(
        (track) => track.id,
      ),
    ).toEqual(['1', '2', '3', '6']);
    expect(harmonicMatches(tracks, tracks[5], entries)).toEqual([]);
    expect(harmonicMatches(tracks, tracks[0], {})).toEqual([]);
  });
});
