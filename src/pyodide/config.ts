/**
 * Pyodide backend settings, shared by the browser worker and the Node check
 * (`npm run test:wasm`).
 */

/** Pyodide release; the Node check asserts the npm devDependency matches. */
export const PYODIDE_VERSION = '314.0.6';
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/** Compiled packages shipped by Pyodide itself. */
export const PYODIDE_PACKAGES = ['numpy', 'scipy', 'micropip'];

/**
 * Pure-Python requirements installed from PyPI with micropip. Mirrors
 * `server/pyproject.toml` minus what cannot run in the browser: `uvicorn`
 * (the worker calls the ASGI app directly) and pylinkage's `numba` extra.
 */
export const PYPI_REQUIREMENTS = [
  'pylinkage[scipy,svg]>=1.2.2,<2',
  'fastapi>=0.109.0',
  'pydantic-settings>=2.1.0',
];

/** Where `npm run build:wheel` puts the server wheel, relative to the site root. */
export const WHEEL_DIR = 'wheels/';
export const WHEEL_MANIFEST = `${WHEEL_DIR}manifest.json`;

export interface WheelManifest {
  wheel: string;
  version: string;
}
