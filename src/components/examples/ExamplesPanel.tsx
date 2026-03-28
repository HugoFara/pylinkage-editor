/**
 * Full-width examples gallery with cards.
 * Replaces the sidebar dropdown with a visual browser.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { examplesApi, simulationApi } from '../../api/client';
import { useMechanismStore, resetCounters } from '../../stores/mechanismStore';
import { useEditorStore } from '../../stores/editorStore';

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px',
    height: '100%',
    overflow: 'auto',
  },
  heading: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#e6edf3',
    margin: '0 0 8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#8b949e',
    margin: '0 0 24px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'border-color 0.15s',
    cursor: 'default',
  },
  cardName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e6edf3',
    margin: 0,
    textTransform: 'capitalize' as const,
  },
  cardDescription: {
    fontSize: '13px',
    color: '#8b949e',
    margin: 0,
    lineHeight: 1.5,
  },
  badges: {
    display: 'flex',
    gap: '8px',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    background: '#30363d',
    color: '#8b949e',
  },
  loadButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    background: '#238636',
    color: 'white',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s',
    alignSelf: 'flex-start',
  },
  loadButtonDisabled: {
    background: '#21262d',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  error: {
    color: '#f85149',
    fontSize: '13px',
  },
  loading: {
    color: '#8b949e',
    fontSize: '14px',
  },
};

export function ExamplesPanel() {
  const setMechanism = useMechanismStore((s) => s.setMechanism);
  const setLoci = useMechanismStore((s) => s.setLoci);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);

  const {
    data: examples,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['examples'],
    queryFn: examplesApi.list,
  });

  const loadMutation = useMutation({
    mutationFn: examplesApi.load,
    onSuccess: async (mechanism) => {
      resetCounters();
      setMechanism(mechanism);

      // Auto-simulate and switch to Design tab
      try {
        const simResult = await simulationApi.simulate(mechanism.id);
        if (simResult.is_complete) {
          setLoci(simResult.frames, simResult.joint_names);
        }
      } catch (e) {
        console.error('Failed to simulate:', e);
      }

      setActiveTab('design');
    },
  });

  if (isLoading) {
    return (
      <div style={styles.container}>
        <p style={styles.loading}>Loading examples...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>
          Failed to load examples. Is the API server running?
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Example Mechanisms</h2>
      <p style={styles.subtitle}>
        Load a prebuilt mechanism to explore and modify in the Design tab.
      </p>

      <div style={styles.grid}>
        {examples?.map((ex) => (
          <div
            key={ex.name}
            style={styles.card}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = '#58a6ff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = '#30363d';
            }}
          >
            <h3 style={styles.cardName}>{ex.name.replace(/-/g, ' ')}</h3>
            <p style={styles.cardDescription}>{ex.description}</p>
            <div style={styles.badges}>
              <span style={styles.badge}>{ex.link_count} links</span>
              <span style={styles.badge}>{ex.joint_count} joints</span>
            </div>
            <button
              style={{
                ...styles.loadButton,
                ...(loadMutation.isPending ? styles.loadButtonDisabled : {}),
              }}
              onClick={() => loadMutation.mutate(ex.name)}
              disabled={loadMutation.isPending}
            >
              {loadMutation.isPending ? 'Loading...' : 'Load & Edit'}
            </button>
          </div>
        ))}
      </div>

      {loadMutation.error && (
        <p style={{ ...styles.error, marginTop: '16px' }}>
          Failed to load: {(loadMutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
