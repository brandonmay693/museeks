import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

import type useTrackColumnWidths from '../hooks/useTrackColumnWidths';
import TrackListHeaderCell from './TrackListHeaderCell';

type Props = {
  sortable?: boolean;
  showRekordbox?: boolean;
  columns: ReturnType<typeof useTrackColumnWidths>;
  showFinderTags?: boolean;
};

export default function TrackListHeader({
  columns,
  showRekordbox = false,
  sortable = true,
  showFinderTags = false,
}: Props) {
  const { t } = useLingui();

  return (
    <div
      {...stylex.props(styles.trackListHeader)}
      role="group"
      aria-label={t`Track list sorting options`}
    >
      <TrackListHeaderCell
        xstyle={styles.cellRowNumber}
        title="#"
        sortBy={null}
      />
      <TrackListHeaderCell
        xstyle={styles.cellTrackPlaying}
        title="&nbsp;"
        sortBy={null}
      />
      <TrackListHeaderCell
        resize={{
          width: columns.widths.title,
          onChange: (width, commit) => columns.resize('title', width, commit),
          onReset: () => columns.reset('title'),
        }}
        title={t`Title`}
        sortBy={sortable ? 'Title' : null}
      />
      {showRekordbox && (
        <TrackListHeaderCell
          title={t`RB / Key`}
          sortBy={null}
          resize={{
            width: columns.widths.rekordbox,
            onChange: (width, commit) =>
              columns.resize('rekordbox', width, commit),
            onReset: () => columns.reset('rekordbox'),
          }}
        />
      )}
      <TrackListHeaderCell
        resize={{
          width: columns.widths.duration,
          onChange: (width, commit) =>
            columns.resize('duration', width, commit),
          onReset: () => columns.reset('duration'),
        }}
        title={t`Duration`}
        sortBy={sortable ? 'Duration' : null}
      />
      <TrackListHeaderCell
        resize={{
          width: columns.widths.artist,
          onChange: (width, commit) => columns.resize('artist', width, commit),
          onReset: () => columns.reset('artist'),
        }}
        title={t`Artist`}
        sortBy={sortable ? 'Artist' : null}
      />
      <TrackListHeaderCell
        resize={{
          width: columns.widths.album,
          onChange: (width, commit) => columns.resize('album', width, commit),
          onReset: () => columns.reset('album'),
        }}
        title={t`Album`}
        sortBy={sortable ? 'Album' : null}
      />
      <TrackListHeaderCell
        resize={{
          width: columns.widths.genre,
          onChange: (width, commit) => columns.resize('genre', width, commit),
          onReset: () => columns.reset('genre'),
        }}
        title={t`Genre`}
        sortBy={sortable ? 'Genre' : null}
      />
      {showFinderTags && (
        <TrackListHeaderCell
          resize={{
            width: columns.widths.finderTags,
            onChange: (width, commit) =>
              columns.resize('finderTags', width, commit),
            onReset: () => columns.reset('finderTags'),
          }}
          title={t`Museek Genre and Energy`}
          sortBy={sortable ? 'Energy' : null}
        />
      )}
    </div>
  );
}

const styles = stylex.create({
  trackListHeader: {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-color)',
    color: 'var(--tracks-header-color)',
    backgroundColor: 'var(--tracks-header-bg)',
    display: 'flex',
    width: '100%',
    position: 'sticky',
    top: 0,
    zIndex: 5,
  },
  cellTrackPlaying: {
    width: '30px',
  },
  cellRowNumber: {
    width: '64px',
    textAlign: 'right',
  },
});
