import { expect, test } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getTrackByName,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup();

test('Branded themes keep accent controls readable and align library filters right', async () => {
  const { default: SettingsAPI } = await import('../api/SettingsAPI');
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();
  SettingsAPI.applyUIMainColorToUI('#FCB514');
  for (const theme of ['light', 'dark']) {
    SettingsAPI.applyThemeToUI(theme);
    const pause = page.getByRole('button', { name: 'Pause' });
    await expect.element(pause).toHaveStyle({
      color: 'rgb(0, 0, 0)',
      backgroundColor: 'rgb(252, 181, 20)',
    });
  }
  SettingsAPI.applyUIMainColorToUI('#123456');
  expect(
    document.documentElement.style.getPropertyValue('--on-main-color'),
  ).toBe('#FFFFFF');
  await page.getByRole('button', { name: 'Pause' }).click();
});

test.runIf(import.meta.env.PLATFORM === 'macos')(
  'Library filters align right',
  async () => {
    await setupScannedLibrary();
    const filters = page.getByRole('group', { name: 'Filter by Finder tags' });
    await expect.element(filters).toHaveStyle({ justifyContent: 'flex-end' });
  },
);
