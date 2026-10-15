import { readFileSync } from 'node:fs';

const required = readFileSync(
  new URL('../.node-version', import.meta.url),
  'utf8',
).trim();
const [major, minor] = process.versions.node.split('.').map(Number);

// Lingui's CLI uses import.meta.main, unavailable in older Node releases.
if (
  major < 22 ||
  (major === 22 && minor < 19) ||
  major === 23 ||
  (major === 24 && minor < 2)
) {
  console.error(
    `Translation extraction requires a newer Node.js runtime. Use Node ${required} from .node-version (running ${process.version}).`,
  );
  process.exit(1);
}
