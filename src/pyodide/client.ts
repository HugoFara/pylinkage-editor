/**
 * Main-thread side of the in-browser backend: starts the worker and turns
 * `fetch`-shaped calls into worker messages and back into `Response`s.
 */

import type { BridgeResponse, RequestMessage, WorkerMessage } from './worker';

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: BridgeResponse) => void; reject: (e: Error) => void }>();

/** Boot the worker once; resolves when the app answers requests. */
export function startPyodideBackend(onProgress: (message: string) => void): Promise<void> {
  if (ready) return ready;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  ready = new Promise<void>((resolve, reject) => {
    worker!.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      switch (message.type) {
        case 'progress':
          onProgress(message.message);
          break;
        case 'ready':
          resolve();
          break;
        case 'boot-error':
          reject(new Error(message.message));
          break;
        case 'response': {
          const { id, ...response } = message;
          pending.get(id)?.resolve(response);
          pending.delete(id);
          break;
        }
        case 'request-error':
          pending.get(message.id)?.reject(new Error(message.message));
          pending.delete(message.id);
          break;
      }
    };
    worker!.onerror = (event) => reject(new Error(event.message || 'worker failed to start'));
  });
  return ready;
}

/** `fetch` against the in-browser server. Waits for the worker to be ready. */
export async function pyodideFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!ready || !worker) throw new Error('in-browser backend not started');
  await ready;

  if (init.body !== undefined && init.body !== null && typeof init.body !== 'string') {
    throw new Error('in-browser backend only accepts string request bodies');
  }
  const request: RequestMessage = {
    type: 'request',
    id: nextId++,
    method: init.method ?? 'GET',
    url,
    headers: [...new Headers(init.headers).entries()],
    body: init.body ?? '',
  };
  const response = await new Promise<BridgeResponse>((resolve, reject) => {
    pending.set(request.id, { resolve, reject });
    worker!.postMessage(request);
  });
  return toResponse(response);
}

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function toResponse({ status, headers, body, body_b64 }: BridgeResponse): Response {
  let content: BodyInit | null = body ?? null;
  if (body_b64 !== undefined) {
    content = Uint8Array.from(atob(body_b64), (c) => c.charCodeAt(0));
  }
  if (NULL_BODY_STATUSES.has(status)) content = null;
  return new Response(content, { status, headers });
}
