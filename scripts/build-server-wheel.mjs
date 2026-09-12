/**
 * Build the Python server as a wheel for the in-browser (Pyodide) backend.
 *
 * Writes public/wheels/<name>.whl and public/wheels/manifest.json, which the
 * worker reads to know the file name. Run before `vite build` for a static
 * deployment; the dev server does not need it (it proxies to a real backend).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'wheels');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
execFileSync('uv', ['build', '--wheel', '--out-dir', outDir], {
  cwd: join(root, 'server'),
  stdio: 'inherit',
});

const [wheel] = readdirSync(outDir).filter((f) => f.endsWith('.whl'));
if (!wheel) throw new Error(`no wheel produced in ${outDir}`);
const version = wheel.split('-')[1];
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ wheel, version }, null, 2) + '\n');
console.log(`wrote ${join(outDir, wheel)} (${version})`);
