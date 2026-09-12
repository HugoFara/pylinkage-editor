/**
 * `fetch` that goes to whichever backend is available: the HTTP server when
 * one answered the probe, otherwise the Pyodide worker (waiting for it to boot
 * if it is still loading). See `backend.ts` for the probe.
 */

import { useBackendStore } from '../stores/backendStore';
import { pyodideFetch } from '../pyodide/client';

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const { status } = useBackendStore.getState();
  if (status === 'wasm' || status === 'wasm-loading') {
    return pyodideFetch(url, init);
  }
  return fetch(url, init);
}
