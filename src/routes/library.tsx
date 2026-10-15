import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect } from 'react';

import HarmonicMatches from '../components/HarmonicMatches';
import LibraryTagFilters from '../components/LibraryTagFilters';
import RekordboxSource from '../components/RekordboxSource';
import TrackList from '../components/TrackList';
import TrackListStates from '../components/TrackListStates';
import View from '../elements/View';
import useFilteredTracks from '../hooks/useFilteredTracks';
import useFinderTags from '../hooks/useFinderTags';
import useGlobalTrackListStatus from '../hooks/useGlobalTrackListStatus';
import DatabaseBridge from '../lib/bridge-database';
import { matchesFinderTags } from '../lib/finder-tags';
import {
  readLibraryView,
  saveLibraryView,
  validateLibraryView,
} from '../lib/library-view';
import { allTracksQuery, configQuery } from '../lib/queries';
import queryClient from '../lib/query-client';
import type { HarmonicSearch } from '../lib/rekordbox';
import useLibraryStore from '../lib/store';
import type { QueueOrigin } from '../types/museeks';

const QUEUE_ORIGIN: QueueOrigin = { type: 'library' };

export const Route = createFileRoute('/library')({
  component: ViewLibrary,
  validateSearch: validateLibraryView,
  beforeLoad: ({ location, cause, preload }) => {
    // Bare Library navigation resumes the workspace. Explicit URLs and in-place
    // filter edits remain authoritative, including clearing filters or closing matches.
    if (preload || cause !== 'enter') return;
    const saved = readLibraryView();
    if (
      !saved ||
      Object.keys(saved.filters).some((key) =>
        new URLSearchParams(location.searchStr).has(key),
      )
    )
      return;
    useLibraryStore.setState({ search: saved.search });
    if (!Object.values(saved.filters).some((value) => value !== undefined))
      return;
    throw redirect({
      to: '/library',
      search: { ...location.search, ...saved.filters },
      replace: true,
    });
  },
  loader: async () => {
    const [_, playlists] = await Promise.all([
      queryClient.prefetchQuery(allTracksQuery),
      DatabaseBridge.getAllPlaylists(),
    ]);

    return { playlists };
  },
});

function ViewLibrary() {
  const { t } = useLingui();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const librarySearch = useLibraryStore((state) => state.search);
  useEffect(() => {
    saveLibraryView(filters, librarySearch);
  }, [filters, librarySearch]);
  const isMacOS = window.__MUSEEKS_PLATFORM === 'macos';
  const hasTagFilters =
    isMacOS && Boolean(filters.needsTagging || filters.genre || filters.energy);
  const { playlists } = Route.useLoaderData();

  const config = useSuspenseQuery(configQuery).data;

  // Some queries when switching routes can be expensive-ish (like getting all tracks),
  // while at the same time, the data will most of the time never change.
  // Using stale-while-revalidate libraries help us (fake-)loading this page faster
  const { data: tracks, isLoading } = useQuery(allTracksQuery);
  const finderTags = useFinderTags(tracks ?? [], isMacOS);
  const matchingTracks = (tracks ?? []).filter(
    (track) =>
      !hasTagFilters || matchesFinderTags(finderTags.tags[track.path], filters),
  );

  const filteredTracks = useFilteredTracks(
    matchingTracks,
    config.library_sort_by,
    config.library_sort_order,
    finderTags.tags,
  );
  useGlobalTrackListStatus(filteredTracks);

  return (
    <View xstyle={styles.view}>
      <RekordboxSource />
      <div {...stylex.props(styles.workspace, !!filters.match && styles.split)}>
        <section
          aria-label={t`Library tracks`}
          {...stylex.props(styles.mainPane)}
        >
          {isMacOS && (
            <LibraryTagFilters
              filters={filters}
              genres={Object.values(finderTags.tags).flatMap((tags) =>
                tags.genre ? [tags.genre] : [],
              )}
              isFetching={finderTags.isFetching}
              hasErrors={finderTags.hasErrors}
              onChange={(next) =>
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    needsTagging: undefined,
                    genre: undefined,
                    energy: undefined,
                    ...next,
                  }),
                })
              }
              onRefresh={() =>
                void queryClient.invalidateQueries({
                  queryKey: ['finder-tags'],
                })
              }
            />
          )}
          <div {...stylex.props(styles.tracks)}>
            <TrackListStates
              isLoading={
                isLoading ||
                ((hasTagFilters || config.library_sort_by === 'Energy') &&
                  finderTags.isLoading)
              }
              tracks={filteredTracks}
              emptyMessage={
                hasTagFilters && (tracks?.length ?? 0) > 0
                  ? t`No tracks match these tag filters and search.`
                  : undefined
              }
            >
              <TrackList
                layout="default"
                data={filteredTracks}
                finderTags={isMacOS ? finderTags.tags : undefined}
                queueOrigin={QUEUE_ORIGIN}
                tracksDensity={config.track_view_density}
                playlists={playlists}
              />
            </TrackListStates>
          </div>
        </section>
        {filters.match && (
          <HarmonicMatches
            tracks={tracks ?? []}
            finderTags={finderTags.tags}
            tagsLoading={finderTags.isLoading}
            tagsFetching={finderTags.isFetching}
            tagsErrors={finderTags.hasErrors}
            playlists={playlists}
            density={config.track_view_density}
            search={filters}
            onChange={(next: Partial<HarmonicSearch>) =>
              void navigate({
                search: (previous) => ({ ...previous, ...next }),
              })
            }
          />
        )}
      </div>
    </View>
  );
}

const styles = stylex.create({
  view: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  workspace: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    flexGrow: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  split: {
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) minmax(0, 1fr)',
      '@media (max-width: 800px)': 'minmax(0, 1fr)',
    },
    gridTemplateRows: {
      default: 'minmax(0, 1fr)',
      '@media (max-width: 800px)': 'minmax(280px, 1fr) minmax(420px, 1fr)',
    },
    overflowY: 'auto',
    rowGap: '4px',
    columnGap: '4px',
    backgroundColor: 'var(--border-color)',
  },
  mainPane: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'var(--background)',
  },
  tracks: { flexGrow: 1, minHeight: 0, overflow: 'hidden' },
});
