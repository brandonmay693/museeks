import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';
import { render } from 'vitest-browser-react';

import GenreTag from '../components/GenreTag';
import GenreBridge from '../lib/bridge-genre';
import toastManager from '../lib/toast-manager';
import { messages as english } from '../translations/en.po';
import { messages as french } from '../translations/fr.po';

vi.mock('../lib/bridge-genre', () => ({
  default: {
    list: vi.fn<() => Promise<string[]>>(),
    get: vi.fn<(path: string) => Promise<string | null>>(),
    set: vi.fn<(path: string, genre: string | null) => Promise<void>>(),
  },
}));
vi.mock('../lib/toast-manager', () => ({
  default: { add: vi.fn<(options: { title: string; type: string }) => void>() },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(GenreBridge.list).mockResolvedValue([
    'House',
    'Tech House',
    'Techno',
  ]);
  vi.mocked(GenreBridge.get).mockResolvedValue(null);
  vi.mocked(GenreBridge.set).mockResolvedValue();
});

test.each([
  ['en', english],
  ['fr', french],
] as const)(
  'Genre labels and saving work with the %s catalog',
  async (locale, messages) => {
    const missing = vi.fn<(locale: string, id: string) => string>(
      (_, id) => id,
    );
    const i18n = setupI18n({
      locale,
      messages: { [locale]: messages },
      missing,
    });
    const client = new QueryClient();
    await render(
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <GenreTag path="/music/first.flac" />
        </QueryClientProvider>
      </I18nProvider>,
    );
    const select = page.getByRole('combobox', { name: 'Track genre' });
    await expect.element(select).toBeEnabled();
    await select.selectOptions('Tech House');
    await expect
      .poll(() => GenreBridge.set)
      .toHaveBeenCalledWith('/music/first.flac', 'Tech House');
    await expect.element(select).toBeEnabled();
    await expect.element(select).toHaveValue('Tech House');
    await select.selectOptions('');
    await expect
      .poll(() => GenreBridge.set)
      .toHaveBeenCalledWith('/music/first.flac', null);
    await expect.element(select).toBeEnabled();
    await expect.element(select).toHaveValue('');
    expect(missing).not.toHaveBeenCalled();
    client.clear();
  },
);

test('Changing tracks loads that file’s genre and failed writes preserve the saved value', async () => {
  vi.mocked(GenreBridge.get).mockImplementation(async (path) =>
    path.endsWith('second.flac') ? 'Techno' : 'House',
  );
  const i18n = setupI18n({ locale: 'en', messages: { en: english } });
  const client = new QueryClient();
  const view = (path: string) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <GenreTag key={path} path={path} />
      </QueryClientProvider>
    </I18nProvider>
  );
  const rendered = await render(view('/music/first.flac'));
  const select = page.getByRole('combobox', { name: 'Track genre' });
  await expect.element(select).toHaveValue('House');
  await rendered.rerender(view('/music/second.flac'));
  await expect.element(select).toHaveValue('Techno');
  await expect.element(select).toBeEnabled();
  vi.mocked(GenreBridge.set).mockRejectedValueOnce(
    new Error('Read-only drive'),
  );
  await select.selectOptions('House');
  await expect
    .poll(() => toastManager.add)
    .toHaveBeenCalledWith(expect.objectContaining({ type: 'danger' }));
  await expect.element(select).toBeEnabled();
  await expect.element(select).toHaveValue('Techno');
  expect(GenreBridge.set).toHaveBeenCalledWith('/music/second.flac', 'House');
  client.clear();
});
