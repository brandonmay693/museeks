import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';

import Button from '../elements/Button';
import useRekordbox, { rekordboxQuery } from '../hooks/useRekordbox';
import RekordboxBridge from '../lib/bridge-rekordbox';
import { configQuery } from '../lib/queries';

export default function RekordboxSource() {
  const { t } = useLingui();
  const query = useRekordbox();
  const client = useQueryClient();
  const source = useMutation({
    mutationFn: async () => {
      const path = await open({
        title: t`Choose Rekordbox XML export`,
        multiple: false,
        filters: [{ name: 'Rekordbox XML', extensions: ['xml'] }],
      });
      return path ? RekordboxBridge.setSource(path) : undefined;
    },
    onSuccess: async (snapshot) => {
      if (!snapshot) return;
      await client.cancelQueries({ queryKey: rekordboxQuery.queryKey });
      client.setQueryData(rekordboxQuery.queryKey, snapshot);
      await client.invalidateQueries({ queryKey: configQuery.queryKey });
    },
  });
  const data = query.data;
  return (
    <div {...stylex.props(styles.source)}>
      <div {...stylex.props(styles.line)}>
        <strong>Rekordbox</strong>
        <span title={data?.source}>
          {data
            ? t`${Object.keys(data.tracks).length} files · Export updated ${new Date(data.modified_ms).toLocaleString()}`
            : t`Connect an XML export to see keys and find compatible tracks.`}
        </span>
        <Button
          bSize="small"
          disabled={source.isPending}
          onClick={() => source.mutate()}
        >
          {data ? t`Change XML` : t`Connect XML`}
        </Button>
        {data && (
          <Button
            bSize="small"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >{t`Refresh keys`}</Button>
        )}
      </div>
      {(source.error || query.error) && (
        <div role="alert">
          {t`Could not read Rekordbox XML: ${String(source.error ?? query.error)}`}{' '}
          {data && t`Showing the last successful export.`}
        </div>
      )}
      {!!data?.skipped && (
        <div role="status">{t`${data.skipped} entries without local file paths were skipped.`}</div>
      )}
    </div>
  );
}
const styles = stylex.create({
  source: {
    paddingBlock: '6px',
    paddingInline: '10px',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-color-softer)',
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
  },
});
