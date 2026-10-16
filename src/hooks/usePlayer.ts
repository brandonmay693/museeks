import { useSyncExternalStore } from 'react';

import type { Track } from '../generated/typings';
import player, { type PlayerState as PlayerStateType } from '../lib/player';

/**
 * Hook to get a specific slice of player state.
 * Uses useSyncExternalStore for optimal performance and only re-renders when the selected value changes.
 */
export function usePlayerState<T>(selector: (state: PlayerStateType) => T): T {
  return useSyncExternalStore(
    (callback) => {
      player.on('stateChange', callback);
      return () => {
        player.off('stateChange', callback);
      };
    },
    () => selector(player.getState()),
    () => selector(player.getState()),
  );
}

/**
 * Hook to get the currently playing track
 */
export function usePlayingTrack(): Track | null {
  return usePlayerState((state) => {
    if (state.queue.length > 0 && state.queueCursor !== null) {
      return state.queue[state.queueCursor];
    }
    return null;
  });
}

// Audio.currentTime advances independently of React store notifications.
// Share the event-driven timer instead of reading a live clock in getSnapshot.
export { default as usePlayingTrackCurrentTime } from './usePlayingTrackCurrentTime';
