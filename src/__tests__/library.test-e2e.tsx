import { expect, test } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getSortButton,
  getTrackAt,
  getTrackByName,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup();

test('The library tab should display all tracks', async () => {
  await setupScannedLibrary();

  // Ensure we have the 3 test-tracks, but no more
  await expect.element(getTrackAt(0)).toBeInTheDocument();
  await expect.element(getTrackAt(1)).toBeInTheDocument();
  await expect.element(getTrackAt(2)).toBeInTheDocument();
  await expect.element(getTrackAt(3)).not.toBeInTheDocument();

  await expect.element(getTrackAt(0)).toHaveAttribute('aria-selected', 'false');
  await expect.element(getTrackAt(1)).toHaveAttribute('aria-selected', 'false');
  await expect.element(getTrackAt(2)).toHaveAttribute('aria-selected', 'false');
});

test('Tracks should selectable via click + modifiers', async () => {
  await setupScannedLibrary();

  const firstTrack = getTrackAt(0);
  const secondTrack = getTrackAt(1);
  const thirdTrack = getTrackAt(2);

  // Click on a track should select it
  await secondTrack.click();
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'false');

  await thirdTrack.click();
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  // Cmd/Ctrl + click on a selected track should deselect it
  await userEvent.click(firstTrack, {
    modifiers: ['ControlOrMeta'],
    button: 'left',
  });
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  // Clicking a single track should select this one and deselect all others
  await firstTrack.click();
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'false');

  // Clicking on a track with Shift should select all tracks in between
  await thirdTrack.click({ modifiers: ['Shift'] });
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');
});

test('Tracks should be selectable via keyboard only (after a single selection)', async () => {
  await setupScannedLibrary();

  const firstTrack = getTrackAt(0);
  const secondTrack = getTrackAt(1);
  const thirdTrack = getTrackAt(2);

  await expect.element(firstTrack).toHaveTextContent('Whiskey Blues');
  await expect.element(secondTrack).toHaveTextContent('Majestic Blues');
  await expect.element(thirdTrack).toHaveTextContent('Romantic Blues');

  await firstTrack.click();
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'false');

  // Cmd+A should select all tracks
  // await userEvent.keyboard('{ControlOrMeta>}A{/ControlOrMeta}'); // not working, select the text instead :(
  // await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  // await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  // await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  // Use single arrow-up/down to select the previous/next track
  await userEvent.keyboard('[ArrowDown]');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');

  await userEvent.keyboard('[ArrowUp]');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');

  await userEvent.keyboard('[ArrowDown],[ArrowDown]');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  // Use Shift+ArrowUp/Down to select multiple tracks
  await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  // Shift+Arrow should go both ways
  await secondTrack.click();
  await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'false');

  await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');
});

test('Search should filter tracks in the library', async () => {
  await setupScannedLibrary();

  const search = page.getByRole('textbox', { name: 'Search library' });
  const searchClear = page.getByRole('button', { name: 'Clear search' });

  // Searching by a common word should display all tracks
  await search.fill('Blues');
  await expect.element(getTrackAt(0)).toBeInTheDocument();
  await expect.element(getTrackAt(1)).toBeInTheDocument();
  await expect.element(getTrackAt(2)).toBeInTheDocument();

  // Searching by a specific word should display only the matching tracks,
  // regardless of accents and cases
  await search.fill('pixAbày');
  await expect.element(getTrackByName(/Whiskey Blues/)).not.toBeInTheDocument();
  await expect.element(getTrackByName(/Majestic Blues/)).toBeInTheDocument();
  await expect.element(getTrackByName(/Romantic Blues/)).toBeInTheDocument();

  await search.fill('hisk');
  await expect.element(getTrackByName(/Whiskey Blues/)).toBeInTheDocument();
  await expect
    .element(getTrackByName(/Majestic Blues/))
    .not.toBeInTheDocument();
  await expect
    .element(getTrackByName(/Romantic Blues/))
    .not.toBeInTheDocument();

  // Searching by an unknown word should display no tracks and a warning
  await search.fill('Something that does not exist');
  await expect.element(getTrackAt(0)).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('status'))
    .toHaveTextContent('Your search returned no results');

  // Clicking the search clear button should clear the search
  await searchClear.click();
  await expect.element(getTrackAt(0)).toBeInTheDocument();
  await expect.element(getTrackAt(1)).toBeInTheDocument();
  await expect.element(getTrackAt(2)).toBeInTheDocument();
});

test('Column headers should sort tracks in the library', async () => {
  await setupScannedLibrary();

  const firstTrack = getTrackAt(0);
  const secondTrack = getTrackAt(1);
  const thirdTrack = getTrackAt(2);

  const track0content =
    'Whiskey Blues05:00Captain_SleepyAnother Albumrock, blues';
  const track1content = 'Majestic Blues05:00Desicomix07Pixabayblues';
  const track2content = 'Romantic Blues05:00Jean-Paul-VPixabayblues';

  // By default, we sort by artist, album year, album name, track number, disk number
  await expect.element(firstTrack).toHaveTextContent(track0content);
  await expect.element(secondTrack).toHaveTextContent(track1content);
  await expect.element(thirdTrack).toHaveTextContent(track2content);

  // Clicking on the title header should change the sorting to Descending by Artist name
  await getSortButton('Artist').click();
  await expect.element(firstTrack).toHaveTextContent(track2content);
  await expect.element(secondTrack).toHaveTextContent(track1content);
  await expect.element(thirdTrack).toHaveTextContent(track0content);

  // Clicking again should change the sorting back to Ascending by Artist name
  await getSortButton('Artist').click();
  await expect.element(firstTrack).toHaveTextContent(track0content);
  await expect.element(secondTrack).toHaveTextContent(track1content);
  await expect.element(thirdTrack).toHaveTextContent(track2content);

  // Let's sort by title as well
  await getSortButton('Title').click();
  await expect.element(firstTrack).toHaveTextContent(track1content);
  await expect.element(secondTrack).toHaveTextContent(track2content);
  await expect.element(thirdTrack).toHaveTextContent(track0content);
});

test.skipIf(import.meta.env.PLATFORM !== 'macos')(
  'Finder tag filters use missing tags, intersect, and compose with search',
  async () => {
    await setupScannedLibrary();
    const needsTagging = page.getByRole('checkbox', { name: 'Needs tagging' });
    const genre = page.getByRole('combobox', { name: 'Genre', exact: true });
    const energy = page.getByRole('combobox', { name: 'Energy', exact: true });
    await needsTagging.click();
    await expect.element(getTrackByName(/Whiskey Blues/)).toBeInTheDocument();
    await expect.element(getTrackByName(/Majestic Blues/)).toBeInTheDocument();
    await expect
      .element(getTrackByName(/Romantic Blues/))
      .not.toBeInTheDocument();
    await expect
      .poll(() => window.location.hash)
      .toContain('needsTagging=true');

    await genre.selectOptions('House');
    await energy.selectOptions('untagged');
    await expect
      .element(getTrackByName(/Whiskey Blues/))
      .not.toBeInTheDocument();
    await expect.element(getTrackByName(/Majestic Blues/)).toBeInTheDocument();
    await page.getByRole('textbox', { name: 'Search library' }).fill('Whiskey');
    await expect
      .element(page.getByText('No tracks match these tag filters and search.'))
      .toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await genre.selectOptions('untagged');
    await expect.element(getTrackByName(/Whiskey Blues/)).toBeInTheDocument();
    await expect
      .element(getTrackByName(/Majestic Blues/))
      .not.toBeInTheDocument();

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect.element(needsTagging).not.toBeChecked();
    await energy.selectOptions('7');
    await expect.element(getTrackAt(0)).toHaveTextContent('Romantic Blues');
    await expect.element(getTrackAt(1)).not.toBeInTheDocument();
  },
);

test.skipIf(import.meta.env.PLATFORM !== 'macos')(
  'Completing Finder tags removes the track from Needs tagging without stopping playback',
  async () => {
    await setupScannedLibrary();
    await page.getByRole('checkbox', { name: 'Needs tagging' }).click();
    await getTrackByName(/Whiskey Blues/).dblClick();
    const genre = page.getByRole('combobox', { name: 'Track genre' });
    const energy = page.getByRole('combobox', { name: 'Track energy' });
    await expect.element(genre).toBeEnabled();
    await genre.selectOptions('House');
    await expect.element(genre).toBeEnabled();
    await expect.element(getTrackByName(/Whiskey Blues/)).toBeInTheDocument();
    await expect.element(energy).toBeEnabled();
    await energy.selectOptions('7');
    await expect
      .element(getTrackByName(/Whiskey Blues/))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole('banner').getByText('Whiskey Blues'))
      .toBeVisible();
    const pause = page.getByRole('button', { name: 'Pause' });
    await expect.element(pause).toBeVisible();
    await page.getByRole('button', { name: 'Refresh tags' }).click();
    await expect
      .element(page.getByRole('button', { name: 'Refresh tags' }))
      .toBeEnabled();
    await expect
      .element(getTrackByName(/Whiskey Blues/))
      .not.toBeInTheDocument();
    await pause.click();
  },
);

test.runIf(import.meta.env.PLATFORM === 'macos')(
  'The Finder tag column shows both values and updates missing values after saves',
  async () => {
    await setupScannedLibrary();
    await expect
      .element(
        page.getByRole('button', {
          name: 'Museek Genre and Energy',
          exact: true,
        }),
      )
      .toBeVisible();
    const whiskey = getTrackByName(/Whiskey Blues/);
    await whiskey.dblClick();
    const energy = page.getByRole('combobox', { name: 'Track energy' });
    const genre = page.getByRole('combobox', { name: 'Track genre' });
    await expect.element(energy).toBeEnabled();
    await energy.selectOptions('');
    await expect.element(genre).toBeEnabled();
    await genre.selectOptions('');
    await expect
      .element(whiskey.getByText('? - ?', { exact: true }))
      .toBeVisible();
    await expect
      .element(
        getTrackByName(/Majestic Blues/).getByText('House - ?', {
          exact: true,
        }),
      )
      .toBeVisible();
    await expect
      .element(
        getTrackByName(/Romantic Blues/).getByText('House - 7', {
          exact: true,
        }),
      )
      .toBeVisible();

    await expect.element(energy).toBeEnabled();
    await energy.selectOptions('7');
    await expect
      .element(whiskey.getByText('? - 7', { exact: true }))
      .toBeVisible();
    await expect.element(genre).toBeEnabled();
    await genre.selectOptions('House');
    await expect
      .element(whiskey.getByText('House - 7', { exact: true }))
      .toBeVisible();
    await expect.element(energy).toBeEnabled();
    await energy.selectOptions('');
    await expect
      .element(whiskey.getByText('House - ?', { exact: true }))
      .toBeVisible();
    await page.getByRole('button', { name: 'Pause' }).click();
  },
);

test.runIf(import.meta.env.PLATFORM === 'macos')(
  'The Finder tag header sorts by energy and reorders after editing a tag',
  async () => {
    await setupScannedLibrary();
    await getTrackByName(/Whiskey Blues/).dblClick();
    const energy = page.getByRole('combobox', { name: 'Track energy' });
    await expect.element(energy).toBeEnabled();
    await energy.selectOptions('2');
    const sort = getSortButton('Museek Genre and Energy');
    await sort.click();
    await expect.element(getTrackAt(0)).toHaveTextContent('Whiskey Blues');
    await expect.element(getTrackAt(1)).toHaveTextContent('Romantic Blues');
    await expect.element(getTrackAt(2)).toHaveTextContent('Majestic Blues');
    await sort.click();
    await expect.element(getTrackAt(0)).toHaveTextContent('Romantic Blues');
    await expect.element(getTrackAt(1)).toHaveTextContent('Whiskey Blues');
    await expect.element(getTrackAt(2)).toHaveTextContent('Majestic Blues');
    await expect.element(energy).toBeEnabled();
    await energy.selectOptions('10');
    await expect.element(getTrackAt(0)).toHaveTextContent('Whiskey Blues');
    await expect.element(getTrackAt(1)).toHaveTextContent('Romantic Blues');
    await page.getByRole('button', { name: 'Pause' }).click();
  },
);
