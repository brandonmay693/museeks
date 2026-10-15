import { invoke } from '@tauri-apps/api/core';

import type { FinderTags } from '../generated/typings';

const FinderTagsBridge = {
  get: (paths: string[]): Promise<Record<string, FinderTags>> =>
    invoke('plugin:energy|get_finder_tags', { paths }),
};

export default FinderTagsBridge;
