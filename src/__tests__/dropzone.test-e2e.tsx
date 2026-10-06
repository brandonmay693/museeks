import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { beforeEach, expect, test, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-react';

import DropzoneImport from '../components/DropzoneImport';
import { messages } from '../translations/en.po';

const mocks = vi.hoisted(() => ({
  listen: vi
    .fn<
      (
        handler: (event: {
          payload: { type: 'drop'; paths: string[] };
        }) => Promise<void>,
      ) => Promise<() => void>
    >()
    .mockResolvedValue(() => {}),
  stat: vi.fn<
    (path: string) => Promise<{ isFile: boolean; isDirectory: boolean }>
  >(),
  folders: vi.fn<(paths: string[]) => Promise<void>>().mockResolvedValue(),
  scan: vi
    .fn<(refresh: boolean, paths: string[]) => Promise<void>>()
    .mockResolvedValue(),
  invalidate: vi.fn<() => Promise<void>>().mockResolvedValue(),
  toast: vi.fn<(options: { type: string }) => void>(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onDragDropEvent: mocks.listen }),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({ lstat: mocks.stat }));
vi.mock('../api/LibraryAPI', () => ({
  default: { addLibraryFolders: mocks.folders, scan: mocks.scan },
}));
vi.mock('../hooks/useInvalidate', () => ({ default: () => mocks.invalidate }));
vi.mock('../lib/toast-manager', () => ({ default: { add: mocks.toast } }));

beforeEach(() => {
  vi.clearAllMocks();
  i18n.load('en', messages);
  i18n.activate('en');
});

test.each([false, true])(
  'Drops individual tracks, with folders: %s',
  async (withFolder) => {
    const file = '/music/Blaqq track.FLAC';
    const folder = '/another album';
    mocks.stat.mockImplementation(async (path) => ({
      isFile: path === file,
      isDirectory: path === folder,
    }));
    await render(
      <I18nProvider i18n={i18n}>
        <DropzoneImport />
      </I18nProvider>,
    );
    await expect.poll(() => mocks.listen.mock.calls.length).toBe(1);
    const handler = mocks.listen.mock.calls[0][0];
    await handler({
      payload: { type: 'drop', paths: withFolder ? [folder, file] : [file] },
    });

    expect(mocks.scan).toHaveBeenCalledWith(
      false,
      withFolder ? [folder, file] : [file],
    );
    expect(mocks.folders.mock.calls).toEqual(withFolder ? [[[folder]]] : []);
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'warning' }),
    );
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  },
);
