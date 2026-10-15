import { invoke } from '@tauri-apps/api/core';

import type { RekordboxSnapshot } from '../generated/typings';

const RekordboxBridge = {
  get: (): Promise<RekordboxSnapshot | null> =>
    invoke('plugin:rekordbox|get_snapshot'),
  setSource: (path: string): Promise<RekordboxSnapshot> =>
    invoke('plugin:rekordbox|set_source', { path }),
};
export default RekordboxBridge;
