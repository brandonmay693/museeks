import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';
import { render } from 'vitest-browser-react';

import EnergyTag from '../components/EnergyTag';
import { messages as english } from '../translations/en.po';
import { messages as french } from '../translations/fr.po';

vi.mock('../lib/bridge-energy', () => ({
  default: {
    get: async () => null,
    set: vi.fn<(path: string, level: number | null) => Promise<void>>(),
  },
}));

test.each([
  ['en', english],
  ['fr', french],
] as const)(
  'Energy labels are available in the %s catalog',
  async (locale, messages) => {
    const missing = vi.fn<(locale: string, id: string) => string>(
      (_, id) => `Missing translation: ${id}`,
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
          <EnergyTag path="/music/track.mp3" />
        </QueryClientProvider>
      </I18nProvider>,
    );

    await expect.element(page.getByRole('combobox')).toBeEnabled();
    const labels = [
      'Energy: untagged',
      '1 · Ambient',
      '2 · Mellow',
      '3 · Laid-back',
      '4 · Warm-up',
      '5 · Steady groove',
      '6 · Driving',
      '7 · High energy',
      '8 · Peak time',
      '9 · Intense',
      '10 · Maximum',
    ];
    for (const label of labels) {
      await expect
        .element(page.getByRole('option', { name: label, exact: true }))
        .toBeInTheDocument();
    }
    expect(missing).not.toHaveBeenCalled();
    client.clear();
  },
);
