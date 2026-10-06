import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { lstat } from '@tauri-apps/plugin-fs';
import { useEffect, useState } from 'react';

import LibraryAPI from '../api/LibraryAPI';
import useInvalidate from '../hooks/useInvalidate';
import toastManager from '../lib/toast-manager';
import { logAndNotifyError } from '../lib/utils';

export default function DropzoneImport() {
  const { t } = useLingui();

  const [isShown, setIsShown] = useState(false);
  const invalidate = useInvalidate();

  // Simplification welcome
  useEffect(() => {
    async function attachFileDropEvent() {
      const unlisten = getCurrentWindow()
        .onDragDropEvent(async (event) => {
          if (event.payload.type === 'over') {
            setIsShown(true);
          } else if (event.payload.type === 'drop') {
            setIsShown(false);

            const fileInfos = await Promise.all(
              event.payload.paths.map(async (path) => {
                return {
                  ...(await lstat(path)),
                  path,
                };
              }),
            );

            const folders = fileInfos
              .filter((fileOrFolder) => fileOrFolder.isDirectory)
              .map((folderInfo) => folderInfo.path);

            const files = fileInfos
              .filter((fileInfo) => fileInfo.isFile)
              .map((fileInfo) => fileInfo.path);

            const skippedItemsCount =
              event.payload.paths.length - folders.length - files.length;

            if (skippedItemsCount !== 0) {
              const message = plural(skippedItemsCount, {
                one: '# invalid item ignored',
                other: '# invalid items ignored',
              });

              toastManager.add({ title: message, type: 'warning' });
            }

            if (folders.length > 0) {
              await LibraryAPI.addLibraryFolders(folders);

              const message = plural(folders.length, {
                one: '# folder added to the library',
                other: '# folders added to the library',
              });

              toastManager.add({ title: message, type: 'success' });
            }

            if (folders.length > 0 || files.length > 0) {
              // Import individual files without adding their parent folders.
              await LibraryAPI.scan(false, [...folders, ...files]);
              await invalidate();
            }
          } else {
            setIsShown(false);
          }
        })
        .catch(logAndNotifyError);

      return unlisten;
    }

    const unlisten = attachFileDropEvent().catch(logAndNotifyError);

    return function cleanup() {
      void unlisten.then((unlisten) => (unlisten ? unlisten() : null));
    };
  }, [invalidate]);

  return (
    <div {...stylex.props(styles.dropzone, isShown && styles.shown)}>
      <div
        {...stylex.props(styles.dropzoneTitle)}
      >{t`Add music to the library`}</div>
      <span>{t`Drop music files or folders anywhere`}</span>
    </div>
  );
}

const styles = stylex.create({
  dropzone: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    backgroundColor: 'var(--faded-bg)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    opacity: 0,
    transition: 'opacity 0.1s ease-in-out',
  },
  shown: {
    opacity: 1,
  },
  dropzoneTitle: {
    fontSize: '1.4rem',
    marginBottom: '8px',
  },
});
