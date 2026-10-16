import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

import Button from '../elements/Button';
import ButtonIcon from '../elements/ButtonIcon';
import type { Config, FinderTags, Playlist, Track } from '../generated/typings';
import useRekordbox from '../hooks/useRekordbox';
import { matchesFinderTags } from '../lib/finder-tags';
import player from '../lib/player';
import queryClient from '../lib/query-client';
import {
  camelotKey,
  compatibleKeys,
  harmonicMatches,
  trackRekordbox,
  type HarmonicSearch,
} from '../lib/rekordbox';
import { logAndNotifyError } from '../lib/utils';
import {
  filterTracks,
  getSortOrder,
  sortTracks,
  stripAccents,
} from '../lib/utils-library';
import LibraryTagFilters from './LibraryTagFilters';
import TrackList from './TrackList';
import TrackListStates from './TrackListStates';
import TrackWaveform from './TrackWaveform';

const QUEUE_ORIGIN = { type: 'library' } as const;

type Props = {
  tracks: Track[];
  finderTags: Record<string, FinderTags>;
  tagsLoading: boolean;
  tagsFetching: boolean;
  tagsErrors: boolean;
  playlists: Playlist[];
  density: Config['track_view_density'];
  search: HarmonicSearch;
  onChange: (next: Partial<HarmonicSearch>) => void;
};

export default function HarmonicMatches(props: Props) {
  const { t } = useLingui();
  const rb = useRekordbox();
  const { search, onChange, finderTags } = props;
  const reference = props.tracks.find((track) => track.id === search.match);
  const key = reference
    ? camelotKey(trackRekordbox(reference, rb.entries)?.key)
    : null;
  const standard = compatibleKeys(key);
  const allKeys = compatibleKeys(key, search.adventurous);
  const matches = reference
    ? harmonicMatches(props.tracks, reference, rb.entries, search.adventurous)
    : [];
  const filters = {
    genre: search.matchGenre,
    energy: search.matchEnergy,
    needsTagging: search.matchNeedsTagging,
  };
  const isMacOS = window.__MUSEEKS_PLATFORM === 'macos';
  const hasFilters =
    isMacOS && Boolean(filters.genre || filters.energy || filters.needsTagging);
  const tagged = hasFilters
    ? matches.filter((track) =>
        matchesFinderTags(finderTags[track.path], filters),
      )
    : matches;
  const searched = filterTracks(tagged, stripAccents(search.matchSearch ?? ''));
  const order = search.matchOrder ?? 'Asc';
  const tracks = sortTracks(
    searched,
    getSortOrder('Energy', order, finderTags),
    order,
  );
  const empty = !reference
    ? t`The reference track is no longer in your library.`
    : !key
      ? t`This track has no recognized key in the connected Rekordbox export.`
      : t`No compatible tracks match these filters. Try clearing the filters or refreshing the XML export.`;

  return (
    <section aria-label={t`Harmonic matches`} {...stylex.props(styles.pane)}>
      <div {...stylex.props(styles.heading)}>
        <div {...stylex.props(styles.title)}>
          <strong>{t`Compatible tracks`}</strong>
          <div {...stylex.props(styles.referenceRow)}>
            <span {...stylex.props(styles.reference)} title={reference?.title}>
              {reference?.title ?? t`Track unavailable`} {key && `· ${key}`}
            </span>
            {reference && (
              <ButtonIcon
                icon="play"
                iconSize={16}
                label={t`Play reference track`}
                xstyle={styles.referencePlay}
                onClick={() => {
                  const state = player.getState();
                  const current =
                    state.queueCursor === null
                      ? undefined
                      : state.queue[state.queueCursor];
                  // Resume an already selected reference; otherwise audition it
                  // ahead of the current compatible results.
                  const playback =
                    current?.id === reference.id
                      ? player.play()
                      : player.start(
                          [reference, ...tracks],
                          reference.id,
                          QUEUE_ORIGIN,
                        );
                  void playback.catch(logAndNotifyError);
                }}
              />
            )}
          </div>
        </div>
        <Button
          onClick={() => onChange({ match: undefined })}
        >{t`Close matches`}</Button>
        {reference && (
          <div {...stylex.props(styles.waveform)}>
            <TrackWaveform track={reference} reference />
          </div>
        )}
      </div>
      <div {...stylex.props(styles.tools)}>
        <div>{t`Entire Museeks library · ${tracks.length} matches`}</div>
        <div>
          {t`Standard keys:`} <strong>{standard.join(' · ') || '—'}</strong>
        </div>
        <label {...stylex.props(styles.label)}>
          <input
            type="checkbox"
            checked={search.adventurous ?? false}
            onChange={(event) =>
              onChange({ adventurous: event.target.checked || undefined })
            }
          />
          {t`Adventurous transitions`}
        </label>
        {search.adventurous && (
          <div role="note">
            {t`Experimental +2 / +7 Camelot jumps:`}{' '}
            {allKeys.slice(4).join(' · ')}.{' '}
            {t`Audition these transitions; they are not standard harmonic matches.`}
          </div>
        )}
        <div {...stylex.props(styles.searchRow)}>
          <input
            type="search"
            aria-label={t`Search compatible tracks`}
            placeholder={t`Search compatible tracks…`}
            value={search.matchSearch ?? ''}
            onChange={(event) =>
              onChange({ matchSearch: event.target.value || undefined })
            }
            {...stylex.props(styles.input)}
          />
          <select
            aria-label={t`Compatible track order`}
            value={order}
            onChange={(event) =>
              onChange({
                matchOrder: event.target.value === 'Dsc' ? 'Dsc' : 'Asc',
              })
            }
            {...stylex.props(styles.input)}
          >
            <option value="Asc">{t`Energy: low to high`}</option>
            <option value="Dsc">{t`Energy: high to low`}</option>
          </select>
        </div>
      </div>
      {isMacOS && (
        <LibraryTagFilters
          filters={filters}
          genres={Object.values(finderTags).flatMap((tags) =>
            tags.genre ? [tags.genre] : [],
          )}
          isFetching={props.tagsFetching}
          hasErrors={props.tagsErrors}
          onChange={(next) =>
            onChange({
              matchGenre: next.genre,
              matchEnergy: next.energy,
              matchNeedsTagging: next.needsTagging,
            })
          }
          onRefresh={() =>
            void queryClient.invalidateQueries({ queryKey: ['finder-tags'] })
          }
        />
      )}
      <div {...stylex.props(styles.results)}>
        <TrackListStates
          tracks={tracks}
          isLoading={rb.isPending || (hasFilters && props.tagsLoading)}
          emptyMessage={empty}
        >
          <TrackList
            secondary
            layout="default"
            data={tracks}
            finderTags={finderTags}
            queueOrigin={QUEUE_ORIGIN}
            tracksDensity={props.density}
            playlists={props.playlists}
          />
        </TrackListStates>
      </div>
    </section>
  );
}
const styles = stylex.create({
  pane: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    height: '100%',
    overflowY: 'auto',
    backgroundColor: 'var(--background)',
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: '12px',
    columnGap: '12px',
    padding: '12px',
    backgroundColor: 'var(--tracks-header-bg)',
    borderTopWidth: '2px',
    borderTopStyle: 'solid',
    borderTopColor: 'var(--main-color)',
  },
  title: { minWidth: 0, flexShrink: 1, flexGrow: 1, flexBasis: '0%' },
  waveform: { width: '100%', minWidth: 0 },
  referenceRow: {
    display: 'flex',
    alignItems: 'center',
    columnGap: '8px',
    marginTop: '4px',
    minWidth: 0,
  },
  referencePlay: {
    flexShrink: 0,
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'var(--main-color)',
    color: 'var(--on-main-color)',
    cursor: 'pointer',
  },
  reference: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-muted)',
  },
  tools: {
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '8px',
    columnGap: '8px',
    fontSize: '0.9rem',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    rowGap: '6px',
    columnGap: '6px',
  },
  searchRow: {
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
  },
  input: {
    minWidth: 0,
    flexGrow: 1,
    backgroundColor: 'var(--input-bg)',
    color: 'var(--input-color)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-color)',
    borderRadius: 'var(--border-radius)',
    padding: '6px',
  },
  results: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: '120px',
    overflow: 'hidden',
  },
});
