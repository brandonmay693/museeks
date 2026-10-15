import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';

import Button from '../elements/Button';
import GenreBridge from '../lib/bridge-genre';
import type { FinderTagFilters } from '../lib/finder-tags';

type Props = {
  filters: FinderTagFilters;
  genres: string[];
  isFetching: boolean;
  hasErrors: boolean;
  onChange: (filters: FinderTagFilters) => void;
  onRefresh: () => void;
};

export default function LibraryTagFilters({
  filters,
  genres,
  isFetching,
  hasErrors,
  onChange,
  onRefresh,
}: Props) {
  const { t } = useLingui();
  const availableGenres = useQuery({
    queryKey: ['genres'],
    queryFn: () => GenreBridge.list(),
    staleTime: Infinity,
    retry: false,
  });
  const options = [
    ...new Set([
      ...(availableGenres.data ?? []),
      ...genres,
      ...(filters.genre && filters.genre !== 'untagged' ? [filters.genre] : []),
    ]),
  ].sort();
  return (
    <div {...stylex.props(styles.container)}>
      <div
        role="group"
        aria-label={t`Filter by Finder tags`}
        {...stylex.props(styles.controls)}
      >
        <label
          {...stylex.props(styles.label)}
          title={t`Show tracks missing genre or energy`}
        >
          <input
            type="checkbox"
            checked={filters.needsTagging ?? false}
            onChange={(event) =>
              onChange({ needsTagging: event.target.checked || undefined })
            }
          />
          {t`Needs tagging`}
        </label>
        <label {...stylex.props(styles.label)}>
          {t`Genre`}
          <select
            {...stylex.props(styles.select)}
            value={filters.genre ?? ''}
            onChange={(event) =>
              onChange({ ...filters, genre: event.target.value || undefined })
            }
          >
            <option value="">{t`Any`}</option>
            <option value="untagged">{t`Untagged`}</option>
            {options.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </label>
        <label {...stylex.props(styles.label)}>
          {t`Energy`}
          <select
            {...stylex.props(styles.select)}
            value={filters.energy ?? ''}
            onChange={(event) =>
              onChange({
                ...filters,
                energy:
                  event.target.value === 'untagged'
                    ? 'untagged'
                    : event.target.value
                      ? Number(event.target.value)
                      : undefined,
              })
            }
          >
            <option value="">{t`Any`}</option>
            <option value="untagged">{t`Untagged`}</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map(
              (level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ),
            )}
          </select>
        </label>
        <Button
          onClick={() => onChange({})}
          disabled={!filters.needsTagging && !filters.genre && !filters.energy}
        >{t`Clear filters`}</Button>
        <Button onClick={onRefresh} disabled={isFetching}>
          {isFetching ? t`Reading tags…` : t`Refresh tags`}
        </Button>
      </div>
      {hasErrors && (
        <p
          role="status"
          {...stylex.props(styles.message)}
        >{t`Some Finder tags could not be read. Those tracks are excluded from tag filters. Check that your music files are available, then refresh tags.`}</p>
      )}
      {availableGenres.isError && (
        <p role="status" {...stylex.props(styles.message)}>
          {t`Could not load the genre list.`}{' '}
          <Button
            onClick={() => void availableGenres.refetch()}
          >{t`Retry`}</Button>
        </p>
      )}
    </div>
  );
}

const styles = stylex.create({
  container: {
    flexShrink: 0,
    padding: '10px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-color-softer)',
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    rowGap: '10px',
    columnGap: '10px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    rowGap: '6px',
    columnGap: '6px',
    fontSize: '0.9rem',
  },
  select: {
    padding: '5px',
    maxWidth: '190px',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--input-color)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-color-softer)',
    borderRadius: 'var(--border-radius)',
  },
  message: { marginTop: '8px', marginBottom: 0, fontSize: '0.9rem' },
});
