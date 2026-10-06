import { invoke } from '@tauri-apps/api/core';

const GenreBridge = {
  list: (): Promise<string[]> => invoke('plugin:energy|get_genres'),
  get: (path: string): Promise<string | null> =>
    invoke('plugin:energy|get_genre', { path }),
  set: (path: string, genre: string | null): Promise<void> =>
    invoke('plugin:energy|set_genre', { path, genre }),
};

export default GenreBridge;
