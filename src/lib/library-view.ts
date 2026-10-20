import { type FinderTagFilters, validateFinderTagFilters } from './finder-tags';
import { validateMatchSortBy, type HarmonicSearch } from './rekordbox';

export const LIBRARY_VIEW_STORAGE_KEY = 'museeks-library-view';

export function validateLibraryView(
  search: Record<string, unknown>,
): FinderTagFilters & HarmonicSearch {
  const matching = validateFinderTagFilters({
    genre: search.matchGenre,
    energy: search.matchEnergy,
    needsTagging: search.matchNeedsTagging,
  });
  return {
    ...validateFinderTagFilters(search),
    match:
      typeof search.match === 'string' || typeof search.match === 'number'
        ? String(search.match)
        : undefined,
    matchSearch:
      typeof search.matchSearch === 'string' ? search.matchSearch : undefined,
    matchGenre: matching.genre,
    matchEnergy: matching.energy,
    matchNeedsTagging: matching.needsTagging,
    adventurous:
      search.adventurous === true || search.adventurous === 'true'
        ? true
        : undefined,
    matchSortBy: validateMatchSortBy(search.matchSortBy),
    matchOrder:
      search.matchOrder === 'Dsc' || search.matchOrder === 'Asc'
        ? search.matchOrder
        : undefined,
  };
}

export function readLibraryView() {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(LIBRARY_VIEW_STORAGE_KEY) ?? 'null',
    );
    if (
      !value ||
      typeof value !== 'object' ||
      !('filters' in value) ||
      !value.filters ||
      typeof value.filters !== 'object'
    )
      return null;
    return {
      filters: validateLibraryView(value.filters as Record<string, unknown>),
      search:
        'search' in value && typeof value.search === 'string'
          ? value.search
          : '',
    };
  } catch {
    return null;
  }
}

export function saveLibraryView(
  filters: FinderTagFilters & HarmonicSearch,
  search: string,
) {
  try {
    localStorage.setItem(
      LIBRARY_VIEW_STORAGE_KEY,
      JSON.stringify({ filters: validateLibraryView(filters), search }),
    );
  } catch {
    // Keep navigation functional when browser storage is unavailable.
  }
}
