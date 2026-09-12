/**
 * Backend availability.
 *
 * The GitHub Pages deployment is the frontend alone: `/api` is answered by the
 * Pages 404 page. Probe once at startup; when nothing answers, start the
 * in-browser backend (pylinkage under Pyodide, see `../pyodide/`) and, until
 * it is up, serve the bundled examples and the client-side solver.
 *
 * Set `VITE_WASM_BACKEND=off` to build without the in-browser backend.
 */

import { startPyodideBackend } from '../pyodide/client';
import { useBackendStore, type BackendStatus } from '../stores/backendStore';

const API_BASE = '/api';
const PROBE_TIMEOUT_MS = 3000;
const WASM_ENABLED = import.meta.env.VITE_WASM_BACKEND !== 'off';

export type { BackendStatus };

/** True when `/api` answers with the server's JSON banner, not an HTML 404. */
export async function probeBackend(): Promise<boolean> {
  try {
    const response = await fetch(API_BASE, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const info = (await response.json()) as { name?: unknown };
    return typeof info.name === 'string';
  } catch {
    return false;
  }
}

let initialized = false;

/** Probe once per page load and pick the backend. Safe to call repeatedly. */
export function initBackend(): void {
  if (initialized) return;
  initialized = true;
  const { setStatus } = useBackendStore.getState();

  probeBackend().then(async (online) => {
    if (online) {
      setStatus('online');
      return;
    }
    if (!WASM_ENABLED) {
      setStatus('offline');
      return;
    }
    setStatus('wasm-loading', 'starting');
    try {
      await startPyodideBackend((message) => setStatus('wasm-loading', message));
      setStatus('wasm');
    } catch (error) {
      setStatus('wasm-failed', error instanceof Error ? error.message : String(error));
    }
  });
}

export function useBackendStatus(): BackendStatus {
  return useBackendStore((s) => s.status);
}
