/**
 * Backend availability.
 *
 * The GitHub Pages deployment is the frontend alone: `/api` is answered by the
 * Pages 404 page. Probe once at startup so the UI can switch to the static demo
 * (bundled examples, client-side solver) instead of failing request by request.
 */

import { useQuery } from '@tanstack/react-query';

const API_BASE = '/api';
const PROBE_TIMEOUT_MS = 3000;

export type BackendStatus = 'checking' | 'online' | 'offline';

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

export function useBackendStatus(): BackendStatus {
  const { data } = useQuery({
    queryKey: ['backend-status'],
    queryFn: probeBackend,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  if (data === undefined) return 'checking';
  return data ? 'online' : 'offline';
}
