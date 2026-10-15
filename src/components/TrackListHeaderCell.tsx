import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import React, { useCallback, useRef } from 'react';

import type { Config, SortBy, SortOrder } from '../generated/typings';
import {
  MIN_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
} from '../hooks/useTrackColumnWidths';
import ConfigBridge from '../lib/bridge-config';
import { configQuery } from '../lib/queries';
import Icon from './Icon';

type Props = {
  title: string;
  resize?: {
    width: number;
    onChange: (width: number, commit: boolean) => void;
    onReset: () => void;
  };
  xstyle?: stylex.CompiledStyles;
  sortBy?: SortBy | null;
};

export default function TrackListHeaderCell(props: Props) {
  const { sortBy, xstyle, title, resize } = props;
  const { t } = useLingui();
  const drag = useRef<{
    pointerId: number;
    x: number;
    width: number;
    current: number;
  } | null>(null);
  const queryClient = useQueryClient();

  const config = useSuspenseQuery(configQuery).data;

  const icon =
    sortBy && config.library_sort_by === sortBy
      ? config.library_sort_order === 'Asc'
        ? 'chevronUp'
        : 'chevronDown'
      : null;

  const sortMutation = useMutation({
    mutationFn: async (newSort: { sortBy: SortBy; sortOrder: SortOrder }) => {
      await ConfigBridge.multiSet({
        library_sort_by: newSort.sortBy,
        library_sort_order: newSort.sortOrder,
      });
    },
    onMutate: async (newSort) => {
      await queryClient.cancelQueries({ queryKey: configQuery.queryKey });
      const previousConfig = queryClient.getQueryData<Config>(
        configQuery.queryKey,
      );
      queryClient.setQueryData(configQuery.queryKey, {
        ...previousConfig,
        library_sort_by: newSort.sortBy,
        library_sort_order: newSort.sortOrder,
      });
      return { previousConfig };
    },
  });

  const handleSort = useCallback(() => {
    if (!sortBy) return;
    const newSortOrder: SortOrder =
      sortBy === config.library_sort_by
        ? config.library_sort_order === 'Asc'
          ? 'Dsc'
          : 'Asc'
        : 'Asc';
    sortMutation.mutate({ sortBy, sortOrder: newSortOrder });
  }, [sortBy, config.library_sort_by, config.library_sort_order, sortMutation]);

  const content = (
    <React.Fragment>
      <div {...stylex.props(styles.name)}>{title}</div>
      {icon && (
        <div {...stylex.props(styles.icon)}>
          <Icon name={icon} size={12} />
        </div>
      )}
    </React.Fragment>
  );

  return (
    <div
      {...stylex.props(styles.container, xstyle)}
      style={resize ? { width: resize.width } : undefined}
    >
      <button
        type="button"
        disabled={sortBy === null}
        onClick={handleSort}
        {...stylex.props(styles.trackCellHeader, sortBy && styles.sortable)}
      >
        {content}
      </button>
      {resize && (
        <div
          role="separator"
          aria-label={t`Resize ${title}`}
          aria-orientation="vertical"
          aria-valuemin={MIN_COLUMN_WIDTH}
          aria-valuemax={MAX_COLUMN_WIDTH}
          aria-valuenow={resize.width}
          tabIndex={0}
          title={t`Drag to resize. Double-click to reset. Use arrow keys to adjust.`}
          {...stylex.props(styles.resizeHandle)}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => {
            event.stopPropagation();
            resize.onReset();
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              width: resize.width,
              current: resize.width,
            };
          }}
          onPointerMove={(event) => {
            const active = drag.current;
            if (!active || active.pointerId !== event.pointerId) return;
            active.current = Math.max(
              MIN_COLUMN_WIDTH,
              Math.min(
                MAX_COLUMN_WIDTH,
                active.width + event.clientX - active.x,
              ),
            );
            resize.onChange(active.current, false);
          }}
          onPointerUp={(event) => {
            const active = drag.current;
            if (!active || active.pointerId !== event.pointerId) return;
            drag.current = null;
            resize.onChange(active.current, true);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            if (drag.current) resize.onChange(drag.current.width, false);
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            if (drag.current) resize.onChange(drag.current.current, true);
            drag.current = null;
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            const step = event.shiftKey ? 50 : 10;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              resize.onChange(
                resize.width + (event.key === 'ArrowRight' ? step : -step),
                true,
              );
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault();
              resize.onChange(
                event.key === 'Home' ? MIN_COLUMN_WIDTH : MAX_COLUMN_WIDTH,
                true,
              );
            } else if (event.key === 'Enter') {
              event.preventDefault();
              resize.onReset();
            }
          }}
        />
      )}
    </div>
  );
}

const styles = stylex.create({
  container: {
    position: 'relative',
    display: 'flex',
    flexShrink: 0,
    minWidth: 0,
  },
  resizeHandle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '6px',
    cursor: 'col-resize',
    touchAction: 'none',
    zIndex: 1,
    borderRightWidth: '2px',
    borderRightStyle: 'solid',
    borderRightColor: {
      default: 'transparent',
      ':hover': 'var(--main-color)',
      ':focus-visible': 'var(--main-color)',
    },
  },
  trackCellHeader: {
    width: '100%',
    minWidth: 0,
    fontWeight: 'var(--bold)',
    appearance: 'none',
    borderWidth: '0',
    backgroundColor: 'transparent',
    textAlign: 'left',
    padding: 0,
    cursor: 'default',
    display: 'flex',
    alignItems: 'center',
    color: 'inherit',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'var(--border-color)',
  },
  sortable: {
    backgroundColor: {
      default: 'transparent',
      ':focus': 'rgba(0 0 0 / 0.025)',
      ':active': 'rgba(0 0 0 / 0.04)',
    },
  },
  icon: {
    marginBlock: '4px',
    marginInline: '0',
    paddingBlock: '0',
    paddingInline: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  name: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    marginBlock: '4px',
    marginInline: '0',
    paddingBlock: '0',
    paddingInline: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
});
