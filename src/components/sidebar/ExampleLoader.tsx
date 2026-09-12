/**
 * Dropdown to load prebuilt example mechanisms.
 * Updated for link-first approach.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { examplesApi, simulationApi } from '../../api/client';
import { useBackendStatus } from '../../api/backend';
import { listBundledExamples, loadBundledExample } from '../../data/examples';
import { useMechanismStore, resetCounters } from '../../stores/mechanismStore';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #30363d',
    background: '#21262d',
    color: '#e6edf3',
    fontSize: '13px',
    cursor: 'pointer',
    width: '100%',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    background: '#238636',
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  buttonDisabled: {
    background: '#21262d',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  error: {
    color: '#f85149',
    fontSize: '12px',
  },
  info: {
    color: '#8b949e',
    fontSize: '12px',
  },
};

export function ExampleLoader() {
  const [selectedExample, setSelectedExample] = useState<string>('');
  const setMechanism = useMechanismStore((s) => s.setMechanism);
  const setLoci = useMechanismStore((s) => s.setLoci);
  const backend = useBackendStatus();

  // Fetch available examples; without a backend, serve the bundled dump
  const {
    data: examples,
    isLoading: loadingExamples,
    error: examplesError,
  } = useQuery({
    queryKey: ['examples', backend],
    queryFn: backend === 'online' ? examplesApi.list : listBundledExamples,
    enabled: backend !== 'checking',
  });

  // Load example mutation
  const loadMutation = useMutation({
    mutationFn: async (name: string) => {
      if (backend !== 'online') {
        return loadBundledExample(name);
      }
      const mechanism = await examplesApi.load(name);
      // Also fetch simulation data
      try {
        const simResult = await simulationApi.simulate(mechanism.id);
        if (simResult.is_complete) {
          return { mechanism, frames: simResult.frames, jointNames: simResult.joint_names };
        }
      } catch (e) {
        console.error('Failed to simulate:', e);
      }
      return { mechanism, frames: null, jointNames: null };
    },
    onSuccess: ({ mechanism, frames, jointNames }) => {
      resetCounters();
      setMechanism(mechanism);
      if (frames) {
        setLoci(frames, jointNames);
      }
    },
  });

  const handleLoad = () => {
    if (selectedExample) {
      loadMutation.mutate(selectedExample);
    }
  };

  const selectedInfo = examples?.find((e) => e.name === selectedExample);

  return (
    <div style={styles.container}>
      <select
        style={styles.select}
        value={selectedExample}
        onChange={(e) => setSelectedExample(e.target.value)}
        disabled={loadingExamples || backend === 'checking'}
      >
        <option value="">Select an example...</option>
        {examples?.map((ex) => (
          <option key={ex.name} value={ex.name}>
            {ex.name} ({ex.link_count} links)
          </option>
        ))}
      </select>

      {selectedInfo && <p style={styles.info}>{selectedInfo.description}</p>}

      <button
        style={{
          ...styles.button,
          ...(!selectedExample || loadMutation.isPending
            ? styles.buttonDisabled
            : {}),
        }}
        onClick={handleLoad}
        disabled={!selectedExample || loadMutation.isPending}
      >
        {loadMutation.isPending ? 'Loading...' : 'Load Example'}
      </button>

      {examplesError && <p style={styles.error}>Failed to load examples</p>}
      {loadMutation.error && (
        <p style={styles.error}>
          Failed to load: {(loadMutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
