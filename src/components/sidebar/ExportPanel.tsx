/**
 * Export panel for downloading the mechanism in various formats.
 */

import { useState } from 'react';
import { useMechanismStore } from '../../stores/mechanismStore';
import { exportApi } from '../../api/client';

type ExportFormat = 'python' | 'svg' | 'dxf' | 'step';

interface FormatOption {
  key: ExportFormat;
  label: string;
  description: string;
}

const FORMATS: FormatOption[] = [
  { key: 'python', label: 'Python Code', description: 'Pylinkage script' },
  { key: 'svg', label: 'SVG', description: 'Vector diagram' },
  { key: 'dxf', label: 'DXF', description: 'AutoCAD / CNC' },
  { key: 'step', label: 'STEP', description: '3D CAD model' },
];

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  button: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#e6edf3',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'border-color 0.15s',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  label: {
    fontWeight: 500,
  },
  description: {
    fontSize: '11px',
    color: '#8b949e',
  },
  error: {
    fontSize: '12px',
    color: '#f85149',
    padding: '4px 0',
  },
};

export function ExportPanel() {
  const mechanism = useMechanismStore((s) => s.mechanism);
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canExport = mechanism != null && mechanism.is_buildable;

  const handleExport = async (format: ExportFormat) => {
    if (!mechanism || loading) return;

    setLoading(format);
    setError(null);

    try {
      const data = {
        name: mechanism.name,
        joints: mechanism.joints,
        links: mechanism.links,
        ground: mechanism.ground ?? undefined,
      };
      await exportApi[format](data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={styles.container}>
      {FORMATS.map((fmt) => (
        <button
          key={fmt.key}
          style={{
            ...styles.button,
            ...((!canExport || loading) ? styles.buttonDisabled : {}),
          }}
          disabled={!canExport || loading !== null}
          onClick={() => handleExport(fmt.key)}
          onMouseOver={(e) => {
            if (canExport && !loading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#58a6ff';
            }
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#30363d';
          }}
        >
          <span style={styles.label}>
            {loading === fmt.key ? 'Exporting...' : fmt.label}
          </span>
          <span style={styles.description}>{fmt.description}</span>
        </button>
      ))}
      {error && <div style={styles.error}>{error}</div>}
      {!canExport && mechanism && (
        <div style={styles.error}>Mechanism must be buildable to export</div>
      )}
    </div>
  );
}
