import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

import type { SortBy } from '../generated/typings';
import type { TrackColumn } from '../hooks/useTrackColumnWidths';
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const visible = columns.order.filter((column) =>
    column === 'rekordbox' || column === 'bpm'
      ? showRekordbox
      : column === 'finderTags'
        ? showFinderTags
        : true,
  );
  const labels: Record<TrackColumn, string> = {
    title: t`Title`,
    rekordbox: t`RB / Key`,
    bpm: t`RB BPM`,
    duration: t`Duration`,
    artist: t`Artist`,
    album: t`Album`,
    genre: t`Genre`,
    finderTags: t`Museek Genre and Energy`,
  };
  const sorts: Record<TrackColumn, SortBy | null> = {
    title: 'Title',
    rekordbox: null,
    bpm: null,
    duration: 'Duration',
    artist: 'Artist',
    album: 'Album',
    genre: 'Genre',
    finderTags: 'Energy',
  };
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
      <DndContext
        sensors={sensors}
        collisionDetection={(args) =>
          args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)
        }
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={({ active, over }) => {
          if (over)
            columns.move(active.id as TrackColumn, over.id as TrackColumn);
        }}
      >
        <SortableContext
          items={visible}
          strategy={horizontalListSortingStrategy}
        >
          {visible.map((column) => (
            <TrackListHeaderCell
              key={column}
              column={column}
              title={labels[column]}
              sortBy={sortable ? sorts[column] : null}
              resize={{
                width: columns.widths[column],
                onChange: (width, commit) =>
                  columns.resize(column, width, commit),
                onReset: () => columns.reset(column),
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
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
