import { QueryClient } from '@tanstack/react-query';
import { describe, expect, test } from 'vite-plus/test';

import type { FinderTags } from '../../generated/typings';
import {
  matchesFinderTags,
  updateFinderTagCache,
  validateFinderTagFilters,
} from '../finder-tags';

const tracks: FinderTags[] = [
  { genre: null, energy: null, error: null },
  { genre: 'House', energy: null, error: null },
  { genre: null, energy: 7, error: null },
  { genre: 'House', energy: 7, error: null },
  { genre: 'Techno', energy: 8, error: null },
  { genre: null, energy: null, error: 'File unavailable' },
];

describe('Finder tag filtering', () => {
  test('needs tagging matches either missing field, but not read errors', () => {
    expect(
      tracks.filter((tags) => matchesFinderTags(tags, { needsTagging: true })),
    ).toEqual(tracks.slice(0, 3));
    expect(matchesFinderTags(undefined, { needsTagging: true })).toBe(false);
  });
  test('individual filters intersect and ignore unrelated tags', () => {
    expect(
      tracks.filter((tags) =>
        matchesFinderTags(tags, { genre: ['untagged'], energy: 'untagged' }),
      ),
    ).toEqual([tracks[0]]);
    expect(
      tracks.filter((tags) =>
        matchesFinderTags(tags, { genre: ['House'], energy: 'untagged' }),
      ),
    ).toEqual([tracks[1]]);
    expect(
      tracks.filter((tags) =>
        matchesFinderTags(tags, { genre: ['House'], energy: 7 }),
      ),
    ).toEqual([tracks[3]]);
    expect(
      tracks.filter((tags) =>
        matchesFinderTags(tags, { needsTagging: true, genre: ['House'] }),
      ),
    ).toEqual([tracks[1]]);
    expect(tracks.filter((tags) => matchesFinderTags(tags, {}))).toEqual(
      tracks,
    );
  });
  test('validates URL state including invalid energy levels', () => {
    expect(
      validateFinderTagFilters({
        needsTagging: 'true',
        genre: 'House',
        energy: '7',
      }),
    ).toEqual({ needsTagging: true, genre: ['House'], energy: 7 });
    for (const energy of [0, 11, 1.5, 'bad', null, undefined]) {
      expect(
        validateFinderTagFilters({ needsTagging: 'false', genre: [], energy }),
      ).toEqual({
        needsTagging: undefined,
        genre: undefined,
        energy: undefined,
      });
    }
  });
  test('selected genres match any choice while intersecting with energy', () => {
    expect(
      tracks.filter((tags) =>
        matchesFinderTags(tags, { genre: ['House', 'Techno'] }),
      ),
    ).toEqual([tracks[1], tracks[3], tracks[4]]);
    expect(
      tracks.filter((tags) =>
        matchesFinderTags(tags, { genre: ['House', 'untagged'], energy: 7 }),
      ),
    ).toEqual([tracks[2], tracks[3]]);
    expect(
      tracks.filter((tags) => matchesFinderTags(tags, { genre: [] })),
    ).toEqual(tracks);
    expect(
      validateFinderTagFilters({
        genre: ['House', null, '', 'House', 'Techno', 4],
      }).genre,
    ).toEqual(['House', 'Techno']);
  });
  test('saving updates every cached batch containing the track, preserving its other tag', async () => {
    const client = new QueryClient();
    client.setQueryData(['finder-tags', ['/music/a', '/music/b']], {
      '/music/a': tracks[1],
      '/music/b': tracks[2],
    });
    client.setQueryData(['finder-tags', ['/music/a']], {
      '/music/a': tracks[1],
    });
    await updateFinderTagCache(client, '/music/a', { energy: 7 });
    expect(
      client.getQueryData(['finder-tags', ['/music/a', '/music/b']]),
    ).toEqual({ '/music/a': tracks[3], '/music/b': tracks[2] });
    expect(client.getQueryData(['finder-tags', ['/music/a']])).toEqual({
      '/music/a': tracks[3],
    });
    expect(matchesFinderTags(tracks[3], { needsTagging: true })).toBe(false);
    client.clear();
  });
});
