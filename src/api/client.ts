/**
 * API client for pylinkage backend.
 * Updated for mechanism module (link-first approach).
 */

import type {
  ExampleInfo,
  MechanismDict,
  MechanismListItem,
  MechanismResponse,
  SimulationResponse,
  SynthesisResponse,
  TrajectoryResponse,
} from '../types/mechanism';
import type {
  OptimizationRequest,
  OptimizationResponse,
} from '../types/optimization';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Mechanism CRUD
export const mechanismApi = {
  list: () => fetchJson<MechanismListItem[]>(`${API_BASE}/mechanisms`),

  get: (id: string) => fetchJson<MechanismResponse>(`${API_BASE}/mechanisms/${id}`),

  create: (data: MechanismDict) =>
    fetchJson<MechanismResponse>(`${API_BASE}/mechanisms/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<MechanismDict>) =>
    fetchJson<MechanismResponse>(`${API_BASE}/mechanisms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: async (id: string) => {
    const response = await fetch(`${API_BASE}/mechanisms/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete mechanism: ${response.status}`);
    }
  },
};

// Simulation
export const simulationApi = {
  simulate: (id: string, iterations?: number, dt = 1.0) =>
    fetchJson<SimulationResponse>(`${API_BASE}/mechanisms/${id}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ iterations, dt }),
    }),

  // Direct simulation without storing mechanism first
  simulateDirect: (mechanism: MechanismDict, iterations?: number, dt = 1.0) =>
    fetchJson<SimulationResponse>(`${API_BASE}/mechanisms/simulate`, {
      method: 'POST',
      body: JSON.stringify({ mechanism, iterations, dt }),
    }),

  trajectory: (id: string, iterations?: number, dt = 1.0) =>
    fetchJson<TrajectoryResponse>(`${API_BASE}/mechanisms/${id}/trajectory`, {
      method: 'POST',
      body: JSON.stringify({ iterations, dt }),
    }),

  rotationPeriod: (id: string) =>
    fetchJson<{ rotation_period: number | null; error: string | null }>(
      `${API_BASE}/mechanisms/${id}/rotation-period`
    ),
};

// Examples
export const examplesApi = {
  list: () => fetchJson<ExampleInfo[]>(`${API_BASE}/examples`),

  get: (name: string) => fetchJson<MechanismDict>(`${API_BASE}/examples/${name}`),

  load: (name: string) =>
    fetchJson<MechanismResponse>(`${API_BASE}/examples/${name}/load`, {
      method: 'POST',
    }),
};

// Synthesis
export const synthesisApi = {
  pathGeneration: (
    precisionPoints: { x: number; y: number }[],
    options?: {
      max_solutions?: number;
      require_grashof?: boolean;
      require_crank_rocker?: boolean;
    }
  ) =>
    fetchJson<SynthesisResponse>(`${API_BASE}/synthesis/path-generation`, {
      method: 'POST',
      body: JSON.stringify({
        precision_points: precisionPoints,
        ...options,
      }),
    }),

  functionGeneration: (
    anglePairs: { theta_in: number; theta_out: number }[],
    options?: {
      ground_length?: number;
      require_grashof?: boolean;
      require_crank_rocker?: boolean;
    }
  ) =>
    fetchJson<SynthesisResponse>(`${API_BASE}/synthesis/function-generation`, {
      method: 'POST',
      body: JSON.stringify({
        angle_pairs: anglePairs,
        ...options,
      }),
    }),

  motionGeneration: (
    poses: { x: number; y: number; angle: number }[],
    options?: {
      max_solutions?: number;
      require_grashof?: boolean;
      require_crank_rocker?: boolean;
    }
  ) =>
    fetchJson<SynthesisResponse>(`${API_BASE}/synthesis/motion-generation`, {
      method: 'POST',
      body: JSON.stringify({
        poses,
        ...options,
      }),
    }),
};

// Optimization
export const optimizationApi = {
  optimize: (request: OptimizationRequest) =>
    fetchJson<OptimizationResponse>(`${API_BASE}/optimization`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};

// Export
async function fetchBlob(url: string, body: object): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] ?? 'export';

  return { blob: await response.blob(), filename };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const exportApi = {
  python: async (mechanism: MechanismDict) => {
    const { blob, filename } = await fetchBlob(`${API_BASE}/export/python`, mechanism);
    triggerDownload(blob, filename);
  },

  svg: async (mechanism: MechanismDict) => {
    const { blob, filename } = await fetchBlob(`${API_BASE}/export/svg`, mechanism);
    triggerDownload(blob, filename);
  },

  dxf: async (mechanism: MechanismDict) => {
    const { blob, filename } = await fetchBlob(`${API_BASE}/export/dxf`, mechanism);
    triggerDownload(blob, filename);
  },

  step: async (mechanism: MechanismDict) => {
    const { blob, filename } = await fetchBlob(`${API_BASE}/export/step`, mechanism);
    triggerDownload(blob, filename);
  },
};
