import { expect, test } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getMainNavigation,
  getSortButton,
  getTrackAt,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup();

test('Column resizing aligns rows, preserves sorting, persists, and resets', async () => {
  await setupScannedLibrary();
  const handle = page.getByRole('separator', {
    name: 'Resize Title',
    exact: true,
  });
  const title = getSortButton('Title');
  const initialWidth = title.element().getBoundingClientRect().width;
  const firstTrack = getTrackAt(0).element().textContent;
  await userEvent.dragAndDrop(handle, getSortButton('Artist'));
  await expect
    .poll(() => title.element().getBoundingClientRect().width)
    .toBeGreaterThan(initialWidth + 20);
  const resizedWidth = title.element().getBoundingClientRect().width;
  expect(getTrackAt(0).element().textContent).toBe(firstTrack);
  expect(
    getTrackAt(0).element().children[2].getBoundingClientRect().width,
  ).toBeCloseTo(resizedWidth, 0);
  expect(
    JSON.parse(localStorage.getItem('museeks-track-column-widths')!).title,
  ).toBe(resizedWidth);

  await getMainNavigation().getByRole('link', { name: 'Settings' }).click();
  await getMainNavigation().getByRole('link', { name: 'Library' }).click();
  await expect
    .poll(() => title.element().getBoundingClientRect().width)
    .toBe(resizedWidth);
  await handle.click();
  await userEvent.keyboard('[ArrowRight]');
  await expect
    .poll(() => title.element().getBoundingClientRect().width)
    .toBe(resizedWidth + 10);
  await userEvent.keyboard('[Home]');
  await expect
    .poll(() => title.element().getBoundingClientRect().width)
    .toBe(60);
  await handle.dblClick();
  await expect
    .poll(() => title.element().getBoundingClientRect().width)
    .toBe(initialWidth);
  localStorage.removeItem('museeks-track-column-widths');
});

test.runIf(import.meta.env.PLATFORM === 'macos')(
  'Finder tag column resizes and wide columns remain horizontally accessible',
  async () => {
    await setupScannedLibrary();
    const handle = page.getByRole('separator', {
      name: 'Resize Museek Genre and Energy',
      exact: true,
    });
    await handle.click();
    await userEvent.keyboard('[End]');
    const header = page.getByRole('button', {
      name: 'Museek Genre and Energy',
      exact: true,
    });
    await expect
      .poll(() => header.element().getBoundingClientRect().width)
      .toBe(1200);
    const row = getTrackAt(0).element();
    expect(row.lastElementChild!.getBoundingClientRect().width).toBe(1200);
    const scrollable = page
      .getByRole('listbox', { name: 'Track list' })
      .element().parentElement!.parentElement!;
    expect(scrollable.scrollWidth).toBeGreaterThan(scrollable.clientWidth);
    await userEvent.keyboard('[Enter]');
    await expect
      .poll(() => header.element().getBoundingClientRect().width)
      .toBeLessThan(1200);
    localStorage.removeItem('museeks-track-column-widths');
  },
);
