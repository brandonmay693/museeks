import { useSortable } from '@dnd-kit/sortable';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import type React from 'react';

import type { FinderTags, RekordboxTrack, Track } from '../generated/typings';
import useFormattedDuration from '../hooks/useFormattedDuration';
import type {
  TrackColumnWidths,
  TrackColumn,
} from '../hooks/useTrackColumnWidths';
import { camelotKey } from '../lib/rekordbox';
import PlayingIndicator from './PlayingIndicator';

export type TrackRowEvents = {
  onTrackSelect: (
    event: React.MouseEvent,
    trackID: string,
    trackIndex: number,
  ) => void;
  onContextMenu: (
    event: React.MouseEvent,
    trackID: string,
    trackIndex: number,
  ) => void;
  onPlaybackStart: (trackID: string) => void;
};

type Props = {
  selected: boolean;
  showRekordbox?: boolean;
  rekordbox?: RekordboxTrack;
  columnWidths?: TrackColumnWidths;
  showFinderTags?: boolean;
  finderTags?: FinderTags;
  hasSelectedAbove?: boolean;
  track: Track;
  index: number;
  rowNumber?: number;
  isPlaying?: boolean;
  draggable?: boolean;
  simplified?: boolean;
  showArtistInTitle?: boolean;
  style?: React.CSSProperties;
} & TrackRowEvents;

export default function TrackRow(props: Props) {
  const {
    track,
    index,
    selected,
    draggable,
    onTrackSelect,
    onContextMenu,
    onPlaybackStart,
  } = props;

  const { t } = useLingui();
  const rbKey = camelotKey(props.rekordbox?.key);
  const genreAndEnergy = `${props.finderTags?.genre ?? '?'} - ${props.finderTags?.energy ?? '?'}`;

  const columnStyle = (column: TrackColumn): React.CSSProperties | undefined =>
    props.columnWidths
      ? {
          width: props.columnWidths[column],
          minWidth: 0,
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 'auto',
        }
      : undefined;

  const duration = useFormattedDuration(track.duration);

  // Drag-and-Drop for playlists
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging, // is this item being dragged around
    isOver, // is this item being dragged over by another item
    activeIndex,
    overIndex,
  } = useSortable({
    id: props.track.id,
    disabled: !draggable,
    data: {
      type: 'playlist-track',
      index,
    },
  });

  const isEvenRow = index % 2 === 0;
  const isSelectedWithSelectedAbove =
    selected && props.hasSelectedAbove === true;
  const isDropIndicatorVisible = isOver && !isDragging;
  const isDropAbove = isOver && overIndex < activeIndex;
  const isDropBelow = isOver && overIndex > activeIndex;

  return (
    // oxlint-disable-next-line jsx_a11y/click-events-have-key-events - given by ...listeners
    <li
      onDoubleClick={() => onPlaybackStart(track.id)}
      onMouseDown={(e) => onTrackSelect(e, track.id, index)}
      onClick={(e) => onTrackSelect(e, track.id, index)}
      onContextMenu={(e) => onContextMenu(e, track.id, index)}
      data-is-playing={props.isPlaying === true}
      data-track-id={track.id}
      // dnd-related props:
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // accessibility
      aria-disabled="false" // required
      aria-selected={selected}
      role="option" // technically already given by attributes, but that'll make the linter happy
      // styles
      {...stylex.props(
        trackStyles.track,
        isEvenRow && trackStyles.trackEvenRow,
        selected && trackStyles.trackSelected,
        isSelectedWithSelectedAbove && trackStyles.selectedWithSelectedAbove,
        isDragging && trackStyles.isDragging,
        isDropIndicatorVisible && trackStyles.isDraggedOver,
        isDropAbove && trackStyles.isDraggedOverAbove,
        isDropBelow && trackStyles.isDraggedOverBelow,
      )}
      style={props.style}
    >
      {props.rowNumber !== undefined && (
        <div {...stylex.props(cellStyles.cell, cellStyles.rowNumber)}>
          {props.rowNumber}
        </div>
      )}
      <div {...stylex.props(cellStyles.cell, cellStyles.trackPlaying)}>
        {props.isPlaying ? <PlayingIndicator /> : null}
      </div>
      <div
        style={columnStyle('title')}
        {...stylex.props(cellStyles.cell, cellStyles.title)}
      >
        <span {...stylex.props(cellStyles.titleText)}>{track.title}</span>
        {props.showArtistInTitle === true && track.artists.length > 0 && (
          <span {...stylex.props(cellStyles.artistInTitle)}>
            {'— '}
            {track.artists.join(', ')}
          </span>
        )}
      </div>
      {props.showRekordbox && (
        <div
          {...stylex.props(cellStyles.cell)}
          style={columnStyle('rekordbox')}
          title={
            props.rekordbox
              ? t`In Rekordbox export · Key: ${props.rekordbox.key ?? '—'}`
              : t`Not found in the connected Rekordbox export`
          }
        >
          {props.rekordbox ? `✓ ${rbKey ?? props.rekordbox.key ?? '—'}` : '—'}
        </div>
      )}
      <div
        style={columnStyle('duration')}
        {...stylex.props(
          cellStyles.cell,
          cellStyles.duration,
          props.simplified === true && cellStyles.rightAligned,
        )}
      >
        {duration}
      </div>
      {props.simplified !== true && (
        <>
          <div
            style={columnStyle('artist')}
            {...stylex.props(
              cellStyles.cell,
              cellStyles.artist,
              props.showFinderTags && cellStyles.narrowMetadata,
            )}
          >
            {track.artists.join(', ')}
          </div>
          <div
            style={columnStyle('album')}
            {...stylex.props(
              cellStyles.cell,
              cellStyles.album,
              props.showFinderTags && cellStyles.narrowMetadata,
            )}
          >
            {track.album}
          </div>
          <div
            style={columnStyle('genre')}
            {...stylex.props(
              cellStyles.cell,
              cellStyles.genre,
              props.showFinderTags && cellStyles.narrowGenre,
            )}
          >
            {track.genres.join(', ')}
          </div>
          {props.showFinderTags && (
            <div
              {...stylex.props(cellStyles.cell, cellStyles.finderTags)}
              style={columnStyle('finderTags')}
              title={genreAndEnergy}
            >
              {genreAndEnergy}
            </div>
          )}
        </>
      )}
    </li>
  );
}

const trackStyles = stylex.create({
  track: {
    position: 'relative',
    display: 'flex',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'transparent',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    backgroundColor: 'var(--tracks-bg-even)',
    alignItems: 'center',
    maxWidth: '100%',
  },
  trackEvenRow: {
    backgroundColor: 'var(--tracks-bg-odd)',
  },
  trackSelected: {
    backgroundColor: 'var(--active-item-bg)',
    color: 'var(--active-item-color)',
  },
  selectedWithSelectedAbove: {
    borderTopColor: 'rgba(255 255 255 / 0.2)',
  },
  isDragging: {
    opacity: 0.5,
  },
  isDraggedOver: {
    '::after': {
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 1,
      display: 'block',
      width: '100%',
      content: '""',
      height: '2px',
      backgroundColor: 'var(--main-color)',
    },
  },
  isDraggedOverAbove: {
    '::after': {
      top: '-1px',
    },
  },
  isDraggedOverBelow: {
    '::after': {
      bottom: '-1px',
    },
  },
});

const cellStyles = stylex.create({
  cell: {
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
    paddingRight: '4px',
    paddingLeft: '4px',
    cursor: 'default',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: '24px',
  },
  trackPlaying: {
    width: '30px',
    flexShrink: 0,
  },
  rowNumber: {
    width: '64px',
    flexShrink: 0,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
    display: 'flex',
    alignItems: 'baseline',
    rowGap: '4px',
    columnGap: '4px',
  },
  titleText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  artistInTitle: {
    color: 'var(--text-muted)',
    fontSize: '0.85em',
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  duration: {
    width: '7%',
    minWidth: '70px',
    flexShrink: 0,
  },
  artist: {
    width: '20%',
    flexShrink: 0,
  },
  album: {
    width: '20%',
    flexShrink: 0,
  },
  genre: {
    width: '20%',
    flexShrink: 0,
  },
  narrowMetadata: { width: '15%' },
  narrowGenre: { width: '10%' },
  finderTags: { width: '22%', minWidth: '170px', flexShrink: 0 },
  rightAligned: {
    textAlign: 'right',
    paddingRight: '8px',
  },
});
