import { setupI18n } from '@lingui/core';
import { MenuItem } from '@tauri-apps/api/menu';
import { expect, test, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import type { RekordboxSnapshot } from '../generated/typings';
import { messages } from '../translations/en.po';
import {
  beforeEachSetup,
  getTrackByName,
  getMainNavigation,
  setupScannedLibrary,
  selectGenres,
} from './e2e-helpers';

beforeEachSetup();
const snapshot: RekordboxSnapshot = {
  source: '/music/rekordbox.xml',
  modified_ms: 1700000000000,
  skipped: 0,
  tracks: {
    '/whiskey-blues.mp3': { key: 'Am', bpm: 120 },
    '/majestic-blues.mp3': { key: 'C', bpm: 122.5 },
    '/romantic-blues.mp3': { key: 'Em', bpm: null },
  },
};

test.runIf(import.meta.env.PLATFORM === 'macos')(
  'Right-click matches use the entire library and keep pane search independent',
  async () => {
    // Resolve IDs without macro fallback text, just like a production build.
    const catalog = setupI18n({ locale: 'en', messages: { en: messages } });
    expect(catalog._('JxULGf')).toBe(
      'Connect an XML export to see keys and find compatible tracks.',
    );
    expect(catalog._('mAmSBh')).toBe('Connect XML');
    await setupScannedLibrary();
    const { default: bridge } = await import('../lib/bridge-rekordbox');
    const { default: client } = await import('../lib/query-client');
    vi.spyOn(bridge, 'get').mockResolvedValue(snapshot);
    client.setQueryData(['rekordbox'], snapshot);
    await expect
      .element(getTrackByName(/Whiskey Blues/))
      .toHaveTextContent('8A');
    const search = page.getByRole('textbox', { name: 'Search library' });
    await search.fill('Whiskey');
    const createItem = MenuItem.new.bind(MenuItem);
    const menu = vi
      .spyOn(MenuItem, 'new')
      .mockImplementation((options) => createItem({ ...options }));
    await getTrackByName(/Whiskey Blues/).click({ button: 'right' });
    await expect
      .poll(() =>
        menu.mock.calls.some(
          ([options]) => options.text === 'Find compatible tracks',
        ),
      )
      .toBe(true);
    const options = menu.mock.calls.find(
      ([item]) => item.text === 'Find compatible tracks',
    )![0];
    expect(options.enabled).toBe(true);
    options.action?.('match');
    const pane = page.getByRole('region', { name: 'Harmonic matches' });
    await expect.element(pane).toBeVisible();
    await expect
      .element(pane.getByRole('button', { name: 'RB BPM', exact: true }))
      .toBeVisible();
    await expect
      .element(pane.getByText('122.5', { exact: true }))
      .toBeVisible();
    await expect
      .element(
        pane
          .getByRole('option', { name: /Romantic Blues/ })
          .getByText('—', { exact: true }),
      )
      .toBeVisible();
    const moveBpm = pane.getByRole('button', { name: 'Move RB BPM column' });
    await moveBpm.click();
    await userEvent.keyboard('[Space]');
    await expect.element(moveBpm).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('[ArrowLeft]');
    await userEvent.keyboard('[Space]');
    await expect
      .poll(() =>
        JSON.parse(
          localStorage.getItem('museeks-track-column-order') ?? '[]',
        ).slice(0, 3),
      )
      .toEqual(['title', 'bpm', 'rekordbox']);
    const headers = page.getByRole('group', {
      name: 'Track list sorting options',
    });
    for (const header of headers.elements()) {
      expect(
        Array.from(header.querySelectorAll('[data-column]'))
          .slice(0, 3)
          .map((cell) => cell.getAttribute('data-column')),
      ).toEqual(['title', 'bpm', 'rekordbox']);
    }
    const bpmCell = pane.getByText('122.5', { exact: true }).element();
    expect(bpmCell.nextElementSibling?.textContent).toContain('8B');
    // Resizing still works after moving a column.
    const resizeBpm = pane.getByRole('separator', { name: 'Resize RB BPM' });
    await resizeBpm.click();
    await userEvent.keyboard('[ArrowRight]');
    await expect.element(resizeBpm).toHaveAttribute('aria-valuenow', '95');

    const matches = pane.getByRole('listbox', { name: 'Compatible tracks' });
    await expect
      .element(matches.getByRole('option', { name: /Romantic Blues/ }))
      .toBeVisible();
    await expect
      .element(matches.getByRole('option', { name: /Majestic Blues/ }))
      .toBeVisible();
    await expect
      .element(matches.getByRole('option', { name: /Whiskey Blues/ }))
      .not.toBeInTheDocument();
    await pane
      .getByRole('searchbox', { name: 'Search compatible tracks' })
      .fill('Romantic');
    await expect
      .element(matches.getByRole('option', { name: /Majestic Blues/ }))
      .not.toBeInTheDocument();
    await expect.element(search).toHaveValue('Whiskey');
    await matches.getByRole('option', { name: /Romantic Blues/ }).dblClick();
    await expect
      .element(page.getByRole('banner'))
      .toHaveTextContent('Romantic Blues');
    const { default: player } = await import('../lib/player');
    const referenceWave = pane.getByRole('slider', {
      name: 'Seek reference track',
    });
    await expect.poll(() => player.getCurrentTime()).toBeGreaterThan(0);
    await referenceWave.click();
    await expect
      .element(page.getByRole('banner'))
      .toHaveTextContent('Whiskey Blues');
    await expect.poll(() => player.getCurrentTime()).toBeGreaterThan(100);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const mainWave = page.getByRole('slider', { name: 'Seek playing track' });
    expect(mainWave.element().getBoundingClientRect().width).toBeGreaterThan(
      500,
    );
    await mainWave.click();
    const beforeJump = player.getCurrentTime();
    await page
      .getByRole('banner')
      .getByRole('button', { name: 'Forward 10 seconds' })
      .click();
    await expect
      .poll(() => player.getCurrentTime())
      .toBeCloseTo(beforeJump + 10, 0);
    await page
      .getByRole('banner')
      .getByRole('button', { name: 'Back 10 seconds' })
      .click();
    await expect.poll(() => player.getCurrentTime()).toBeCloseTo(beforeJump, 0);
    await pane.getByRole('button', { name: 'Play reference track' }).click();
    await expect
      .element(page.getByRole('banner'))
      .toHaveTextContent('Whiskey Blues');
    await expect
      .element(
        pane.getByRole('searchbox', { name: 'Search compatible tracks' }),
      )
      .toHaveValue('Romantic');
    await expect
      .element(matches.getByRole('option', { name: /Romantic Blues/ }))
      .toBeVisible();
    await pane
      .getByRole('searchbox', { name: 'Search compatible tracks' })
      .fill('');
    await selectGenres(
      pane.getByRole('button', { name: 'Filter genres', exact: true }),
      ['House', 'Techno'],
    );
    await pane
      .getByRole('combobox', { name: 'Energy', exact: true })
      .selectOptions('7');
    await expect
      .element(matches.getByRole('option', { name: /Romantic Blues/ }))
      .toBeVisible();
    await expect
      .element(matches.getByRole('option', { name: /Majestic Blues/ }))
      .not.toBeInTheDocument();
    await expect.element(getTrackByName(/Whiskey Blues/)).toBeVisible();
    await pane
      .getByRole('checkbox', { name: 'Adventurous transitions' })
      .click();
    await expect.element(pane.getByRole('note')).toHaveTextContent('10A · 3A');
    const library = page.getByRole('region', { name: 'Library tracks' });
    await selectGenres(
      library.getByRole('button', { name: 'Filter genres', exact: true }),
      ['Untagged'],
    );
    await pane
      .getByRole('searchbox', { name: 'Search compatible tracks' })
      .fill('Romantic');
    await pane
      .getByRole('combobox', { name: 'Compatible track order' })
      .selectOptions('Dsc');
    await getMainNavigation().getByRole('link', { name: 'Artists' }).click();
    await expect.element(pane).not.toBeInTheDocument();
    await search.fill('something else');
    await getMainNavigation().getByRole('link', { name: 'Library' }).click();
    await expect.element(search).toHaveValue('Whiskey');
    await expect
      .element(
        library.getByRole('button', { name: 'Filter genres', exact: true }),
      )
      .toHaveTextContent('Untagged');
    await expect.element(pane).toHaveTextContent('Whiskey Blues');
    await expect
      .element(
        pane.getByRole('searchbox', { name: 'Search compatible tracks' }),
      )
      .toHaveValue('Romantic');
    await expect
      .element(pane.getByRole('button', { name: 'Filter genres', exact: true }))
      .toHaveTextContent('2 genres');
    await expect
      .element(pane.getByRole('combobox', { name: 'Energy', exact: true }))
      .toHaveValue('7');
    await expect
      .element(pane.getByRole('combobox', { name: 'Compatible track order' }))
      .toHaveValue('Dsc');
    await expect
      .element(pane.getByRole('checkbox', { name: 'Adventurous transitions' }))
      .toBeChecked();
    await expect
      .element(matches.getByRole('option', { name: /Romantic Blues/ }))
      .toBeVisible();
    await pane.getByRole('button', { name: 'Close matches' }).click();
    await expect.element(pane).not.toBeInTheDocument();
    await expect.element(search).toHaveValue('Whiskey');
    await library.getByRole('button', { name: 'Clear filters' }).click();
    await getMainNavigation().getByRole('link', { name: 'Artists' }).click();
    await getMainNavigation().getByRole('link', { name: 'Library' }).click();
    await expect.element(pane).not.toBeInTheDocument();
    await expect
      .element(
        library.getByRole('button', { name: 'Filter genres', exact: true }),
      )
      .toHaveTextContent('Any');
    await page.getByRole('button', { name: 'Pause' }).click();
  },
);
