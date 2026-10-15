import { describe, expect, test } from 'vite-plus/test';

import type { FinderTags, Track } from '../../generated/typings';
import {
  getSortOrder,
  sortTracks,
  removeRedundantFolders,
  stripAccents,
} from '../utils-library';

describe('stripAccents', () => {
  test('should remove all accentutated characters in a string by its non-accentuated version', () => {
    expect(
      stripAccents(
        'AbCdÀÁÂÃÄÅĄĀàáâãäåąāÒÓÔÕÕÖØòóôõöøÈÉÊËĘĒèéêëðęēÇĆČçćčÐÌÍÎÏĪìíîïīÙÚÛÜŪùúûüūÑŅñņŠŚšśŸÿýŽŹŻžźżŁĻłļŃŅńņàáãảạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệđùúủũụưừứửữựòóỏõọôồốổỗộơờớởỡợìíỉĩịäëïîüûñçýỳỹỵỷğışĞİŞĢģĶķ',
      ),
    ).toStrictEqual(
      'abcdaaaaaaaaaaaaaaaaoooooooooooooeeeeeeeeeeeeeccccccdiiiiiiiiiiuuuuuuuuuunnnnssssyyyzzzzzzllllnnnnaaaaaaaaaaaaaaaaaeeeeeeeeeeeduuuuuuuuuuuoooooooooooooooooiiiiiaeiiuuncyyyyygisgisggkk',
    );
  });
});

describe('removeRedundantFolders', () => {
  test('should return the same array if there are no duplicates or subpaths', () => {
    expect(
      removeRedundantFolders(['/users/me/music', '/users/me/videos']),
    ).toStrictEqual(['/users/me/music', '/users/me/videos']);
  });

  test('should remove duplicate entries', () => {
    expect(
      removeRedundantFolders([
        '/users/me/music',
        '/users/me/videos',
        '/users/me/music',
      ]),
    ).toStrictEqual(['/users/me/music', '/users/me/videos']);
  });

  test('should remove subpaths', () => {
    expect(
      removeRedundantFolders([
        '/tmp/data/music',
        '/users/me/music',
        '/users/me/music/archive',
        '/tmp/data',
      ]),
    ).toStrictEqual(['/users/me/music', '/tmp/data']);
  });
});

describe('energy sorting', () => {
  test('sorts numerically in both directions with unknown levels last and stable artist tie-breaks', () => {
    const tracks: Track[] = [
      'missing',
      'ten',
      'two-b',
      'unreadable',
      'two-a',
      'loading',
    ].map((id) => ({
      id,
      path: id,
      title: id,
      artists: [id],
      album: '',
      album_artist: '',
      genres: [],
      year: null,
      duration: 0,
      track_no: null,
      track_of: null,
      disk_no: null,
      disk_of: null,
      is_compilation: false,
    }));
    const tags: Record<string, FinderTags> = {
      missing: { genre: null, energy: null, error: null },
      ten: { genre: null, energy: 10, error: null },
      'two-b': { genre: null, energy: 2, error: null },
      'two-a': { genre: null, energy: 2, error: null },
      unreadable: { genre: null, energy: 1, error: 'Unavailable' },
    };
    expect(
      sortTracks(tracks, getSortOrder('Energy', 'Asc', tags), 'Asc').map(
        (track) => track.id,
      ),
    ).toEqual(['two-a', 'two-b', 'ten', 'loading', 'missing', 'unreadable']);
    expect(
      sortTracks(tracks, getSortOrder('Energy', 'Dsc', tags), 'Dsc').map(
        (track) => track.id,
      ),
    ).toEqual(['ten', 'two-a', 'two-b', 'loading', 'missing', 'unreadable']);
    expect(tracks[0].id).toBe('missing');
  });
});
