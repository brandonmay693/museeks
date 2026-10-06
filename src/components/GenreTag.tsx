import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import GenreBridge from '../lib/bridge-genre';
import toastManager from '../lib/toast-manager';

export default function GenreTag({ path }: { path: string }) {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const queryKey = ['genre', path];
  const genres = useQuery({
    queryKey: ['genres'],
    queryFn: () => GenreBridge.list(),
    staleTime: Infinity,
    retry: false,
  });
  const genre = useQuery({
    queryKey,
    queryFn: () => GenreBridge.get(path),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (value: string | null) => GenreBridge.set(path, value),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
    },
    onSuccess: (_, value) => {
      queryClient.setQueryData(queryKey, value);
    },
    onError: (error) => {
      toastManager.add({
        title: t`Could not save the genre tag: ${String(error)}`,
        type: 'danger',
      });
    },
  });
  const options = genres.data ?? [];
  const loading = genre.isPending || genres.isPending;
  const busy = genre.isFetching || genres.isFetching || save.isPending;

  return (
    <div {...stylex.props(styles.container)}>
      {genre.isError || genres.isError ? (
        <button
          type="button"
          title={t`Could not load genre tags: ${String(genre.error ?? genres.error)}`}
          onClick={() => {
            void genre.refetch();
            void genres.refetch();
          }}
          {...stylex.props(styles.select)}
        >
          {t`Genre: retry`}
        </button>
      ) : (
        <select
          aria-label={t`Track genre`}
          aria-busy={busy}
          title={t`Save genre as a Finder tag on the original file. Combine it with energy in macOS Smart Folders.`}
          value={genre.data ?? ''}
          disabled={loading || busy}
          onChange={(event) => save.mutate(event.target.value || null)}
          {...stylex.props(styles.select)}
        >
          <option value="">
            {loading ? t`Loading genre…` : t`Genre: untagged`}
          </option>
          {genre.data && !options.includes(genre.data) && (
            <option value={genre.data}>{genre.data}</option>
          )}
          {options.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

const styles = stylex.create({
  container: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: '8px',
  },
  select: {
    width: 'clamp(110px, 12vw, 145px)',
    padding: '5px',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--input-color)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-color-softer)',
    borderRadius: 'var(--border-radius)',
    fontSize: '0.85rem',
    opacity: { ':disabled': 0.6 },
  },
});
