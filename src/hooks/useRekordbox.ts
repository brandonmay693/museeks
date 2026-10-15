import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import RekordboxBridge from '../lib/bridge-rekordbox';
import { rekordboxByPath } from '../lib/rekordbox';

export const rekordboxQuery = {
  queryKey: ['rekordbox'],
  queryFn: RekordboxBridge.get,
  staleTime: 5000,
  refetchInterval: 10000,
  retry: false,
};

export default function useRekordbox() {
  const query = useQuery(rekordboxQuery);
  const entries = useMemo(() => rekordboxByPath(query.data), [query.data]);
  return { ...query, entries };
}
