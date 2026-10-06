import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import EnergyBridge from '../lib/bridge-energy';
import toastManager from '../lib/toast-manager';

export default function EnergyTag({ path }: { path: string }) {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const queryKey = ['energy', path];
  const energy = useQuery({
    queryKey,
    queryFn: () => EnergyBridge.get(path),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (level: number | null) => EnergyBridge.set(path, level),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
    },
    onSuccess: (_, level) => {
      queryClient.setQueryData(queryKey, level);
    },
    onError: (error) => {
      toastManager.add({
        title: t`Could not save the energy tag: ${String(error)}`,
        type: 'danger',
      });
    },
  });
  const labels = [
    t`1 · Ambient`,
    t`2 · Mellow`,
    t`3 · Laid-back`,
    t`4 · Warm-up`,
    t`5 · Steady groove`,
    t`6 · Driving`,
    t`7 · High energy`,
    t`8 · Peak time`,
    t`9 · Intense`,
    t`10 · Maximum`,
  ];

  return (
    <div {...stylex.props(styles.container)}>
      {energy.isError ? (
        <button
          type="button"
          title={t`Could not read Finder tags: ${String(energy.error)}`}
          onClick={() => void energy.refetch()}
          {...stylex.props(styles.select)}
        >
          {t`Energy: retry`}
        </button>
      ) : (
        <select
          aria-label={t`Track energy`}
          aria-busy={energy.isFetching || save.isPending}
          title={t`Save energy as a Finder tag on the original file. Use these tags in macOS Smart Folders.`}
          value={energy.data ?? ''}
          disabled={energy.isFetching || energy.isPending || save.isPending}
          onChange={(event) => {
            const value = event.target.value;
            save.mutate(value === '' ? null : Number(value));
          }}
          {...stylex.props(styles.select)}
        >
          <option value="">
            {save.isPending
              ? t`Saving energy…`
              : energy.isPending
                ? t`Loading energy…`
                : t`Energy: untagged`}
          </option>
          {labels.map((label, index) => (
            <option key={index + 1} value={index + 1}>
              {label}
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
