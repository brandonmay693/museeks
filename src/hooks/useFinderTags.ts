import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { FinderTags, Track } from '../generated/typings';
import FinderTagsBridge from '../lib/bridge-finder-tags';

export default function useFinderTags(tracks: Track[], enabled: boolean) {
  const batches = useMemo(() => {
    const paths = tracks.map((track) => track.path).sort();
    const result: string[][] = [];
    for (let index = 0; index < paths.length; index += 100) {
      result.push(paths.slice(index, index + 100));
    }
    return result;
  }, [tracks]);
  const queries = useQueries({
    queries: batches.map((paths) => ({
      queryKey: ['finder-tags', paths],
      queryFn: () => FinderTagsBridge.get(paths),
      enabled,
      staleTime: Infinity,
      retry: false,
    })),
  });
  const tags: Record<string, FinderTags> = Object.assign(
    {},
    ...queries.map((query) => query.data),
  );
  return {
    tags,
    isLoading: enabled && queries.some((query) => query.isPending),
    isFetching: queries.some((query) => query.isFetching),
    hasErrors:
      queries.some((query) => query.isError) ||
      Object.values(tags).some((tag) => tag.error !== null),
  };
}
