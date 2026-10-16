import { expect, test, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-react';

import { beforeEachSetup } from './e2e-helpers';

beforeEachSetup();

test('Playback time remains stable between events even when the audio clock advances on every read', async () => {
  const { default: player } = await import('../lib/player');
  const { usePlayingTrackCurrentTime } = await import('../hooks/usePlayer');
  let clock = 0;
  const read = vi.spyOn(player, 'getCurrentTime').mockImplementation(() => {
    clock += 0.00001;
    return clock;
  });
  function Clock() {
    return (
      <output aria-label="Playback clock">
        {usePlayingTrackCurrentTime()}
      </output>
    );
  }
  const screen = await render(<Clock />);
  player.emit('timeupdate', 42);
  await expect
    .element(screen.getByLabelText('Playback clock'))
    .toHaveTextContent('42');
  player.emit('timeupdate', 43);
  await expect
    .element(screen.getByLabelText('Playback clock'))
    .toHaveTextContent('43');
  expect(read.mock.calls.length).toBeLessThan(10);
  await screen.unmount();
  read.mockRestore();
});
