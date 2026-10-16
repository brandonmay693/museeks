import type { QueryClient } from '@tanstack/react-query';

import type { FinderTags } from '../generated/typings';

export type FinderTagFilters = {
  needsTagging?: boolean;
  genre?: string[];
  energy?: 'untagged' | number;
};

export function validateFinderTagFilters(
  search: Record<string, unknown>,
): FinderTagFilters {
  const selected = [
    ...new Set(
      (Array.isArray(search.genre) ? search.genre : [search.genre]).filter(
        (genre): genre is string => typeof genre === 'string' && genre !== '',
      ),
    ),
  ];
  return {
    needsTagging:
      search.needsTagging === true || search.needsTagging === 'true'
        ? true
        : undefined,
    genre: selected.length ? selected : undefined,
    energy:
      search.energy === 'untagged'
        ? 'untagged'
        : Number.isInteger(Number(search.energy)) &&
            Number(search.energy) >= 1 &&
            Number(search.energy) <= 10
          ? Number(search.energy)
          : undefined,
  };
}

export function matchesFinderTags(
  tags: FinderTags | undefined,
  filters: FinderTagFilters,
): boolean {
  if (
    !filters.needsTagging &&
    !filters.genre?.length &&
    filters.energy === undefined
  )
    return true;
  // An unreadable file is unknown, not untagged.
  if (!tags || tags.error !== null) return false;
  if (filters.needsTagging && tags.genre !== null && tags.energy !== null)
    return false;
  if (
    filters.genre?.length &&
    !filters.genre.includes(tags.genre ?? 'untagged')
  )
    return false;
  if (
    filters.energy !== undefined &&
    tags.energy !== (filters.energy === 'untagged' ? null : filters.energy)
  )
    return false;
  return true;
}

export async function updateFinderTagCache(
  client: QueryClient,
  path: string,
  update: Partial<Pick<FinderTags, 'genre' | 'energy'>>,
) {
  const filters = {
    queryKey: ['finder-tags'],
    predicate: (query: { queryKey: readonly unknown[] }) =>
      Array.isArray(query.queryKey[1]) && query.queryKey[1].includes(path),
  };
  await client.cancelQueries(filters);
  client.setQueriesData<Record<string, FinderTags>>(filters, (data) => {
    if (!data?.[path]) return data;
    return { ...data, [path]: { ...data[path], ...update } };
  });
  // Recheck the affected batch, including previously unreadable files.
  void client.invalidateQueries(filters);
}
