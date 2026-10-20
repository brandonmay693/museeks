import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useVirtualizer } from '@tanstack/react-virtual';
import type React from 'react';
import { useCallback, useId, useImperativeHandle, useRef } from 'react';

import Scrollable from '../elements/Scrollable';
import type { FinderTags, RekordboxTrack, Track } from '../generated/typings';
import useDndSensors from '../hooks/useDnDSensors';
import useFinderTags from '../hooks/useFinderTags';
import usePlayingTrackID from '../hooks/usePlayingTrackID';
import useTrackColumnWidths from '../hooks/useTrackColumnWidths';
import type { TrackListVirtualizer } from '../types/museeks';
import TrackListHeader from './TrackListHeader';
import type { TrackSortControl } from './TrackListHeaderCell';
import TrackRow, { type TrackRowEvents } from './TrackRow';

const DND_MODIFIERS = [restrictToVerticalAxis];

/** ----------------------------------------------------------------------------
 * List-based layout for TrackList:
 *  - Uses a Virtual List
 *  - Reorderable if needed (for playlists)
 * -------------------------------------------------------------------------- */

type Props = {
  sorting?: TrackSortControl;
  ref: React.RefObject<TrackListVirtualizer | null>;
  tracks: Track[];
  finderTags?: Record<string, FinderTags>;
  reorderable?: boolean;
  rekordbox?: Record<string, RekordboxTrack>;
  sortable?: boolean;
  listLabel?: string;
  selectedTracks: Set<string>;
  initialOffset: number;
  rowHeight: number;
  onReorder?: (tracks: Track[]) => void;
} & TrackRowEvents;

export default function TrackListDefault(props: Props) {
  const {
    ref,
    tracks,
    reorderable,
    selectedTracks,
    initialOffset,
    rowHeight,
    onReorder,
    onTrackSelect,
    onContextMenu,
    onPlaybackStart,
  } = props;

  const { t } = useLingui();
  const showFinderTags = window.__MUSEEKS_PLATFORM === 'macos';
  const loadedTags = useFinderTags(
    tracks,
    showFinderTags && props.finderTags === undefined,
  );
  const finderTags = props.finderTags ?? loadedTags.tags;

  const trackPlayingID = usePlayingTrackID();
  const innerScrollableRef = useRef<HTMLDivElement>(null);

  const columns = useTrackColumnWidths(
    innerScrollableRef,
    showFinderTags,
    !!props.rekordbox,
  );

  const virtualizer = useVirtualizer({
    count: tracks.length,
    initialOffset,
    overscan: 20,
    scrollPaddingEnd: 22, // Height of the track list header
    getScrollElement: () => innerScrollableRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (index) => tracks[index].id,
  });

  // Passes the ref back to the master component for interaction with the
  // scrollable view
  useImperativeHandle(ref, () => {
    return {
      scrollElement: innerScrollableRef.current,
      scrollToIndex: (index) => {
        virtualizer.scrollToIndex(index);
      },
    } satisfies TrackListVirtualizer;
  }, [virtualizer]);

  /**
   * Playlist tracks re-order events handlers
   */
  const sensors = useDndSensors();
  const dndId = useId();

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const {
        active, // dragged item
        over, // on which item it was dropped
      } = event;

      // The item was dropped either nowhere, or on the same item
      if (over == null || active.id === over.id || !onReorder) {
        return;
      }

      const activeIndex = tracks.findIndex((track) => track.id === active.id);
      const overIndex = tracks.findIndex((track) => track.id === over.id);

      const newTracks = [...tracks];

      const movedTrack = newTracks.splice(activeIndex, 1)[0]; // Remove active track
      newTracks.splice(overIndex, 0, movedTrack); // Move it to where the user dropped it

      onReorder(newTracks);
    },
    [onReorder, tracks],
  );

  return (
    <DndContext
      onDragEnd={onDragEnd}
      id={dndId}
      modifiers={DND_MODIFIERS}
      sensors={sensors}
    >
      <Scrollable ref={innerScrollableRef}>
        <div style={{ minWidth: columns.totalWidth }}>
          <TrackListHeader
            columns={columns}
            sorting={props.sorting}
            sortable={!reorderable && props.sortable !== false}
            showRekordbox={!!props.rekordbox}
            showFinderTags={showFinderTags}
          />

          {/* The large inner element to hold all of the items */}
          <ul
            role="listbox"
            aria-multiselectable="true"
            aria-label={props.listLabel ?? t`Track list`}
            {...stylex.props(styles.rows)}
            style={{
              height: `${virtualizer.getTotalSize()}px`,
            }}
          >
            <SortableContext
              items={tracks}
              strategy={verticalListSortingStrategy}
            >
              {/* Only the visible items in the virtualizer, manually positioned to be in view */}
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const track = tracks[virtualItem.index];
                return (
                  <TrackRow
                    key={virtualItem.key}
                    selected={selectedTracks.has(track.id)}
                    track={track}
                    columnWidths={columns.widths}
                    columnOrder={columns.order}
                    showRekordbox={!!props.rekordbox}
                    rekordbox={props.rekordbox?.[track.path.normalize('NFC')]}
                    showFinderTags={showFinderTags}
                    finderTags={finderTags[track.path]}
                    isPlaying={trackPlayingID === track.id}
                    index={virtualItem.index}
                    rowNumber={virtualItem.index + 1}
                    onTrackSelect={onTrackSelect}
                    onContextMenu={onContextMenu}
                    onPlaybackStart={onPlaybackStart}
                    draggable={reorderable}
                    hasSelectedAbove={
                      virtualItem.index > 0 &&
                      selectedTracks.has(tracks[virtualItem.index - 1].id)
                    }
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      // Intentionally not translateY, as it would create another paint
                      // layer where every row would cover elements from the previous one.
                      // This would typically prevent the drop effect to be properly displayed
                      // when reordering a playlist
                      top: `${virtualItem.start}px`,
                      zIndex: 1,
                    }}
                  />
                );
              })}
            </SortableContext>
          </ul>
        </div>
      </Scrollable>
    </DndContext>
  );
}

const styles = stylex.create({
  rows: {
    width: '100%',
    position: 'relative',
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
});
