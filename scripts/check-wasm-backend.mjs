/**
 * Run the server under Pyodide in Node, the way the browser worker does, and
 * exercise the main routes. Catches a dependency that has no wasm wheel or a
 * route that needs threads before it reaches the GitHub Pages demo.
 *
 * Needs `npm run build:wheel` first. Downloads the Pyodide packages from the
 * CDN on the first run (cached in node_modules afterwards). Set
 * PYLINKAGE_WHEEL=/path/to/pylinkage-x.y.z-py3-none-any.whl to test against
 * an unreleased pylinkage instead of the PyPI release config.ts pins.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// config.ts is plain constants; read it without a TS toolchain.
const configSource = readFileSync(join(root, 'src/pyodide/config.ts'), 'utf8');
const constant = (name) => {
  const match = configSource.match(new RegExp(`export const ${name} = ([^;]+);`));
  if (!match) throw new Error(`${name} not found in config.ts`);
  return eval(match[1]); // literals and template strings only
};
const PYODIDE_VERSION = constant('PYODIDE_VERSION');
const PYODIDE_PACKAGES = constant('PYODIDE_PACKAGES');
const PYPI_REQUIREMENTS = constant('PYPI_REQUIREMENTS');

const npmVersion = require('pyodide/package.json').version;
if (npmVersion !== PYODIDE_VERSION) {
  throw new Error(`pyodide devDependency is ${npmVersion}, config.ts says ${PYODIDE_VERSION}`);
}

const manifest = JSON.parse(readFileSync(join(root, 'public/wheels/manifest.json'), 'utf8'));
const bridge = readFileSync(join(root, 'src/pyodide/asgi_bridge.py'), 'utf8');

const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

const pyodide = await loadPyodide();
await pyodide.loadPackage(PYODIDE_PACKAGES);
const micropip = pyodide.pyimport('micropip');
const pylinkageWheel = process.env.PYLINKAGE_WHEEL;
if (pylinkageWheel) {
  const name = pylinkageWheel.split('/').pop();
  pyodide.FS.writeFile(`/${name}`, readFileSync(pylinkageWheel));
  console.log(`using local ${name}`);
  await micropip.install([
    `emfs:/${name}`,
    'drawsvg', // the svg extra; scipy is already loaded above
    ...PYPI_REQUIREMENTS.filter((r) => !r.startsWith('pylinkage')),
  ]);
} else {
  await micropip.install(PYPI_REQUIREMENTS);
}
pyodide.FS.writeFile(`/${manifest.wheel}`, readFileSync(join(root, 'public/wheels', manifest.wheel)));
await micropip.install.callKwargs(`emfs:/${manifest.wheel}`, { deps: false });
console.log(`runtime ready in ${elapsed()}`);

await pyodide.runPythonAsync(bridge);
const handle = pyodide.globals.get('handle');
console.log(`app imported in ${elapsed()}`);

async function call(method, url, body) {
  const headers = JSON.stringify(body === undefined ? [] : [['content-type', 'application/json']]);
  const raw = await handle(method, url, headers, body === undefined ? '' : JSON.stringify(body));
  const response = JSON.parse(raw);
  return { status: response.status, body: response.body, bodyB64: response.body_b64 };
}

function expect(label, response, status = 200, json = true) {
  if (response.status !== status) {
    throw new Error(`${label}: expected ${status}, got ${response.status}: ${response.body?.slice(0, 300)}`);
  }
  console.log(`ok  ${label} (${elapsed()})`);
  return json ? JSON.parse(response.body) : response.body;
}

const examples = expect('GET /api/examples', await call('GET', '/api/examples'));
if (!examples.length) throw new Error('example library is empty');
const loaded = expect('POST /api/examples/four-bar/load', await call('POST', '/api/examples/four-bar/load'));
const simulated = expect(
  `POST /api/mechanisms/${loaded.id}/simulate`,
  await call('POST', `/api/mechanisms/${loaded.id}/simulate`, { dt: 1.0 }),
);
if (!simulated.frames?.length) throw new Error('simulation returned no frames');
const mechanism = expect('GET /api/examples/four-bar', await call('GET', '/api/examples/four-bar'));
const direct = expect('POST /api/mechanisms/simulate', await call('POST', '/api/mechanisms/simulate', { mechanism, dt: 1.0 }));
const synthesis = expect(
  'POST /api/synthesis/path-generation',
  await call('POST', '/api/synthesis/path-generation', {
    precision_points: [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }],
    max_solutions: 3,
    require_grashof: false,
  }),
);
if (!synthesis.solutions?.length) throw new Error('path generation returned no solutions');
expect(
  'POST /api/synthesis/topology-generation',
  await call('POST', '/api/synthesis/topology-generation', {
    precision_points: [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }],
  }),
);
const jointId = 'coupler.1_rocker.0';
const xExtent = (simulation) => {
  const index = simulation.joint_names.indexOf(jointId);
  const xs = simulation.frames.map((frame) => frame.positions[index].x);
  return Math.max(...xs) - Math.min(...xs);
};
const optimized = expect(
  'POST /api/optimization',
  await call('POST', '/api/optimization', {
    mechanism,
    objective: { type: 'x_extent', joint_index: mechanism.joints.findIndex((j) => j.id === jointId) },
    algorithm: { algorithm: 'pso', n_particles: 8, iterations: 8 },
    bounds_factor: 2.0,
  }),
);
const preview = optimized.results?.[0]?.mechanism_dict;
if (!preview) throw new Error(`optimization returned no preview: ${JSON.stringify(optimized.warnings)}`);
const previewRun = expect(
  'POST /api/mechanisms/simulate (optimized)',
  await call('POST', '/api/mechanisms/simulate', { mechanism: preview, dt: 1.0 }),
);
if (!(xExtent(previewRun) > xExtent(direct))) {
  throw new Error(`optimization did not widen the stroke: ${xExtent(previewRun)} vs ${xExtent(direct)}`);
}
const svg = expect('POST /api/export/svg', await call('POST', '/api/export/svg', mechanism), 200, false);
if (!svg.startsWith('<?xml')) throw new Error('svg export did not return XML');
expect('GET /api/nope (404)', await call('GET', '/api/nope'), 404);

console.log(`all routes answered under Pyodide ${PYODIDE_VERSION} in ${elapsed()}`);
