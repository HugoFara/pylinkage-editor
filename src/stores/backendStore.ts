/**
 * Which backend answers `/api`.
 *
 * - `online`: a Python server (the dev proxy or a deployment) answered the probe.
 * - `wasm-loading` / `wasm` / `wasm-failed`: no server; pylinkage is being
 *   started, runs, or could not start inside the browser (Pyodide worker).
 * - `offline`: no server and the in-browser backend is disabled.
 */

import { create } from 'zustand';

export type BackendStatus =
  | 'checking'
  | 'online'
  | 'offline'
  | 'wasm-loading'
  | 'wasm'
  | 'wasm-failed';

interface BackendState {
  status: BackendStatus;
  /** Progress or error detail for the `wasm-*` states. */
  message: string | null;
  setStatus: (status: BackendStatus, message?: string | null) => void;
}

export const useBackendStore = create<BackendState>((set) => ({
  status: 'checking',
  message: null,
  setStatus: (status, message = null) => set({ status, message }),
}));
