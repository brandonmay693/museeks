import { expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getTrackByName,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup();

test.runIf(import.meta.env.PLATFORM === 'macos')(
  'Genre sits left of energy without overflowing the header',
  async () => {
    await setupScannedLibrary();
    await getTrackByName(/Whiskey Blues/).dblClick();
    const genre = page.getByRole('combobox', { name: 'Track genre' });
    const energy = page.getByRole('combobox', { name: 'Track energy' });
    await expect.element(genre).toBeEnabled();
    await expect.element(energy).toBeEnabled();
    const genreBounds = genre.element().getBoundingClientRect();
    const energyBounds = energy.element().getBoundingClientRect();
    const header = page.getByRole('banner').element();
    expect(genreBounds.right).toBeLessThanOrEqual(energyBounds.left);
    expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);
    await page.getByRole('button', { name: 'Pause' }).click();
  },
);

test('Double click on a track should play it and display its metadata', async () => {
  // By default, the player is paused
  await expect
    .element(page.getByRole('button', { name: 'Play' }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Pause' }))
    .not.toBeInTheDocument();

  await setupScannedLibrary();

  // Double-clicking on a track should start the player
  await getTrackByName(/Whiskey Blues/).dblClick();

  await expect
    .element(page.getByRole('button', { name: 'Play' }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Pause' }))
    .toBeInTheDocument();

  // Check the track info is there
  await expect
    .element(page.getByRole('banner').getByText('Whiskey Blues'))
    .toBeVisible();
  await expect
    .element(page.getByRole('banner'))
    .toHaveTextContent('Captain_Sleepy — Another Album');

  // Click on another one
  await getTrackByName(/Romantic Blues/).dblClick();
  await expect
    .element(page.getByRole('button', { name: 'Play' }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Pause' }))
    .toBeInTheDocument();

  // Check the new track info is there
  await expect
    .element(page.getByRole('banner').getByText('Romantic Blues'))
    .toBeVisible();
  await expect
    .element(page.getByRole('banner'))
    .toHaveTextContent('Jean-Paul-V — Pixabay');

  // Pause
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect
    .element(page.getByRole('button', { name: 'Play' }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Pause' }))
    .not.toBeInTheDocument();
});

test('The header artist and album links tolerate a blank artist elsewhere in the library', async () => {
  await setupScannedLibrary();
  const { default: database } = await import('../lib/bridge-database');
  const tracks = await database.getAllTracks();
  const track = tracks.find((item) => item.title === 'Whiskey Blues')!;
  const artists = vi
    .spyOn(database, 'getAllArtists')
    .mockResolvedValue(['', track.album_artist, 'Unknown Artist']);
  const albums = vi.spyOn(database, 'getArtistTracks').mockResolvedValue([
    {
      label: track.album,
      year: track.year,
      genres: track.genres,
      duration: track.duration,
      tracks: [track],
    },
  ]);
  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    const header = page.getByRole('banner');
    await header
      .getByRole('link', { name: 'Captain_Sleepy', exact: true })
      .click();
    await expect
      .element(page.getByRole('heading', { name: 'Another Album' }))
      .toBeVisible();
    await expect.element(getTrackByName(/Whiskey Blues/)).toBeVisible();
    await header
      .getByRole('link', { name: 'Another Album', exact: true })
      .click();
    await expect.poll(() => window.location.hash).toContain('focused_album=');
    await expect.element(getTrackByName(/Whiskey Blues/)).toBeVisible();
    await page.getByRole('button', { name: 'Pause' }).click();
  } finally {
    artists.mockRestore();
    albums.mockRestore();
  }
});
