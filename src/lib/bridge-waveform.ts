import { invoke } from '@tauri-apps/api/core';

import type { Waveform } from '../generated/typings';

const WaveformBridge = {
  get: (path: string) =>
    invoke<Waveform>('plugin:waveform|get_waveform', { path }),
};
export default WaveformBridge;
