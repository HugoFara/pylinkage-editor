/**
 * Web Worker running the Python server in the browser.
 *
 * Boots Pyodide from the CDN, installs pylinkage, FastAPI and the server wheel
 * built by `npm run build:wheel`, then answers `request` messages by calling
 * the ASGI app in-process (see asgi_bridge.py). Keeps the main thread free
 * while synthesis or optimization runs.
 */

import type { PyodideInterface } from 'pyodide';
import bridgeSource from './asgi_bridge.py?raw';
import {
  PYODIDE_INDEX_URL,
  PYODIDE_PACKAGES,
  PYPI_REQUIREMENTS,
  WHEEL_DIR,
  WHEEL_MANIFEST,
  type WheelManifest,
} from './config';

export interface RequestMessage {
  type: 'request';
  id: number;
  method: string;
  url: string;
  headers: [string, string][];
  body: string;
}

export interface BridgeResponse {
  status: number;
  headers: [string, string][];
  body?: string;
  body_b64?: string;
}

export type WorkerMessage =
  | { type: 'progress'; message: string }
  | { type: 'ready' }
  | { type: 'boot-error'; message: string }
  | ({ type: 'response'; id: number } & BridgeResponse)
  | { type: 'request-error'; id: number; message: string };

type Handle = (method: string, url: string, headers: string, body: string) => Promise<string>;

const post = (message: WorkerMessage) => self.postMessage(message);
const progress = (message: string) => post({ type: 'progress', message });

const ready: Promise<Handle> = boot();
ready.then(
  () => post({ type: 'ready' }),
  (error: unknown) => post({ type: 'boot-error', message: describe(error) }),
);

self.onmessage = async (event: MessageEvent<RequestMessage>) => {
  const { id, method, url, headers, body } = event.data;
  try {
    const handle = await ready;
    const raw = await handle(method, url, JSON.stringify(headers), body);
    const response = JSON.parse(raw) as BridgeResponse;
    post({ type: 'response', id, ...response });
  } catch (error) {
    post({ type: 'request-error', id, message: describe(error) });
  }
};

async function boot(): Promise<Handle> {
  progress('downloading the Python runtime');
  const { loadPyodide } = (await import(
    /* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`
  )) as { loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface> };
  const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });

  progress('loading numpy and scipy');
  await pyodide.loadPackage(PYODIDE_PACKAGES);

  progress('installing pylinkage and FastAPI');
  const micropip = pyodide.pyimport('micropip');
  await micropip.install(PYPI_REQUIREMENTS);

  progress('installing the editor server');
  const siteRoot = new URL(import.meta.env.BASE_URL, self.location.origin);
  const manifestResponse = await fetch(new URL(WHEEL_MANIFEST, siteRoot));
  // A dev server answers unknown paths with index.html, so check the type too.
  const isJson = manifestResponse.headers.get('content-type')?.includes('json') ?? false;
  if (!manifestResponse.ok || !isJson) {
    throw new Error(
      `server wheel not found (${manifestResponse.status}); run \`npm run build:wheel\``,
    );
  }
  const manifest = (await manifestResponse.json()) as WheelManifest;
  await micropip.install.callKwargs(new URL(WHEEL_DIR + manifest.wheel, siteRoot).href, {
    deps: false,
  });

  progress('starting the server');
  await pyodide.runPythonAsync(bridgeSource);
  return pyodide.globals.get('handle') as Handle;
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    // Pyodide errors carry the whole Python traceback; keep the last line.
    const lines = error.message.trim().split('\n');
    return lines[lines.length - 1];
  }
  return String(error);
}
