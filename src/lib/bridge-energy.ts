import { invoke } from '@tauri-apps/api/core';

const EnergyBridge = {
  get(path: string): Promise<number | null> {
    return invoke('plugin:energy|get_energy', { path });
  },
  set(path: string, level: number | null): Promise<void> {
    return invoke('plugin:energy|set_energy', { path, level });
  },
};

export default EnergyBridge;
