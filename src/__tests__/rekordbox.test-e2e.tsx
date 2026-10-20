import { setupI18n } from '@lingui/core';
import { MenuItem } from '@tauri-apps/api/menu';
import { expect, test, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import type { RekordboxSnapshot } from '../generated/typings';
import { messages } from '../translations/en.po';
import {
  beforeEachSetup,
  getTrackByName,
  getTrackAt,
  getMainNavigation,
  setupScannedLibrary,
  selectGenres,
} from './e2e-helpers';

beforeEachSetup();
const createMenuItem = MenuItem.new.bind(MenuItem);
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
    const bpmSort = page.getByRole('button', { name: 'RB BPM', exact: true });
    await bpmSort.click();
    await expect.element(getTrackAt(0)).toHaveTextContent('Whiskey Blues');
    await expect.element(getTrackAt(2)).toHaveTextContent('Romantic Blues');
    await bpmSort.click();
    await expect.element(getTrackAt(0)).toHaveTextContent('Majestic Blues');
    await expect.element(getTrackAt(2)).toHaveTextContent('Romantic Blues');
    const search = page.getByRole('textbox', { name: 'Search library' });
    await search.fill('Whiskey');
    const createItem = createMenuItem;
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
    const matchOrdering = pane.getByRole('combobox', {
      name: 'Compatible track order',
    });
    await matchOrdering.selectOptions('BpmAsc');
    await expect
      .element(matches.getByRole('option').first())
      .toHaveTextContent('Majestic Blues');
    await matchOrdering.selectOptions('BpmDsc');
    await expect
      .element(matches.getByRole('option').first())
      .toHaveTextContent('Majestic Blues');
    // A second known BPM must actually move when the pane header toggles.
    const updatedSnapshot = {
      ...snapshot,
      tracks: {
        ...snapshot.tracks,
        '/romantic-blues.mp3': { key: 'Em', bpm: 124 },
      },
    };
    vi.mocked(bridge.get).mockResolvedValue(updatedSnapshot);
    client.setQueryData(['rekordbox'], updatedSnapshot);
    await expect
      .element(matches.getByRole('option').first())
      .toHaveTextContent('Romantic Blues');
    const mainConfig = client.getQueryData(['config']);
    const paneBpm = pane.getByRole('button', { name: 'RB BPM', exact: true });
    await paneBpm.click();
    await expect.element(matchOrdering).toHaveValue('BpmAsc');
    await expect
      .element(matches.getByRole('option').first())
      .toHaveTextContent('Majestic Blues');
    await paneBpm.click();
    await expect.element(matchOrdering).toHaveValue('BpmDsc');
    await expect
      .element(matches.getByRole('option').first())
      .toHaveTextContent('Romantic Blues');
    expect(client.getQueryData(['config'])).toEqual(mainConfig);
    await pane.getByRole('button', { name: 'Title', exact: true }).click();
    await expect.element(matchOrdering).toHaveValue('TitleAsc');
    await expect
      .element(matches.getByRole('option').first())
      .toHaveTextContent('Majestic Blues');
    await matchOrdering.selectOptions('TitleDsc');
    await expect
      .element(matches.getByRole('option').first())
      .toHaveTextContent('Romantic Blues');
    await pane
      .getByRole('button', { name: 'Museek Genre and Energy', exact: true })
      .click();
    await expect.element(matchOrdering).toHaveValue('Asc');
    vi.mocked(bridge.get).mockResolvedValue(snapshot);
    client.setQueryData(['rekordbox'], snapshot);

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
      .selectOptions('BpmDsc');
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
      .toHaveValue('BpmDsc');
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

test.runIf(import.meta.env.PLATFORM === 'macos')(
  'Compatible track controls stay pinned while a long list scrolls',
  async () => {
    await setupScannedLibrary();
    const { default: client } = await import('../lib/query-client');
    const { allTracksQuery } = await import('../lib/queries');
    const { default: bridge } = await import('../lib/bridge-rekordbox');
    const original = client.getQueryData<
      import('../generated/typings').Track[]
    >(allTracksQuery.queryKey)!;
    const extra = Array.from({ length: 80 }, (_, index) => ({
      ...original[0],
      id: `match-${index}`,
      path: `/match-${index}.mp3`,
      title: `Match ${String(index).padStart(3, '0')}`,
    }));
    const manyMatches = {
      ...snapshot,
      tracks: {
        ...snapshot.tracks,
        ...Object.fromEntries(
          extra.map((track) => [track.path, { key: 'Am', bpm: 120 }]),
        ),
      },
    };
    vi.spyOn(bridge, 'get').mockResolvedValue(manyMatches);
    client.setQueryData(['rekordbox'], manyMatches);
    client.setQueryData(allTracksQuery.queryKey, [...original, ...extra]);
    const createItem = createMenuItem;
    const menu = vi
      .spyOn(MenuItem, 'new')
      .mockImplementation((options) => createItem({ ...options }));
    await getTrackByName(/Whiskey Blues/).click({ button: 'right' });
    await expect
      .poll(() =>
        menu.mock.calls.some(
          ([item]) => item.text === 'Find compatible tracks',
        ),
      )
      .toBe(true);
    menu.mock.calls
      .find(([item]) => item.text === 'Find compatible tracks')![0]
      .action?.('match');
    const pane = page.getByRole('region', { name: 'Harmonic matches' });
    const list = pane.getByRole('listbox', { name: 'Compatible tracks' });
    await expect.element(list).toBeVisible();
    const scrollable = list.element().parentElement!.parentElement!;
    const controls = [
      pane.getByRole('button', { name: 'Play reference track' }).element(),
      pane.getByRole('slider', { name: 'Seek reference track' }).element(),
      pane
        .getByRole('searchbox', { name: 'Search compatible tracks' })
        .element(),
      pane.getByRole('button', { name: 'Filter genres' }).element(),
      pane.getByRole('group', { name: 'Track list sorting options' }).element(),
    ];
    const positions = controls.map(
      (control) => control.getBoundingClientRect().top,
    );
    expect(scrollable.clientHeight).toBeGreaterThan(0);
    expect(scrollable.scrollHeight).toBeGreaterThan(scrollable.clientHeight);
    expect(scrollable.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      pane.element().getBoundingClientRect().bottom + 1,
    );
    scrollable.scrollTop = 800;
    await expect.poll(() => scrollable.scrollTop).toBe(800);
    await expect
      .poll(() => list.getByRole('option').first().element().textContent)
      .not.toContain('Match 000');
    controls.forEach((control, index) =>
      expect(control.getBoundingClientRect().top).toBeCloseTo(
        positions[index],
        0,
      ),
    );
    expect(pane.element().scrollHeight).toBe(pane.element().clientHeight);
  },
);
