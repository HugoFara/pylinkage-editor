/**
 * Notice on which backend is answering when it is not a Python server: the
 * in-browser one (loading, running, or failed) or none at all.
 */

import { useBackendStore } from '../../stores/backendStore';

const REPO_URL = 'https://github.com/HugoFara/pylinkage-editor';

const styles: Record<string, React.CSSProperties> = {
  banner: {
    margin: '0 0 8px',
    padding: '8px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    lineHeight: 1.5,
  },
  warning: {
    background: '#3d2e00',
    border: '1px solid #9e6a03',
    color: '#e3b341',
  },
  info: {
    background: '#0c2d6b',
    border: '1px solid #1f6feb',
    color: '#a5d6ff',
  },
  link: {
    color: '#58a6ff',
  },
};

export function BackendBanner() {
  const status = useBackendStore((s) => s.status);
  const message = useBackendStore((s) => s.message);

  const runLocally = (
    <a style={styles.link} href={`${REPO_URL}#getting-started`} target="_blank" rel="noreferrer">
      Run it locally
    </a>
  );

  switch (status) {
    case 'wasm-loading':
      return (
        <div style={{ ...styles.banner, ...styles.info }} role="status">
          <strong>Starting pylinkage in your browser</strong> — {message}… Examples and
          the Design tab already work; synthesis and optimization will once this finishes.
        </div>
      );
    case 'wasm':
      return (
        <div style={{ ...styles.banner, ...styles.info }} role="status">
          <strong>Running in your browser</strong> (Python via Pyodide). Every feature works;
          long optimizations are slower than the native server. {runLocally}
        </div>
      );
    case 'wasm-failed':
      return (
        <div style={{ ...styles.banner, ...styles.warning }} role="status">
          <strong>Static demo</strong> — the in-browser backend could not start ({message}).
          Bundled examples and the Design tab still work; synthesis, optimization and
          export need the Python server. {runLocally}
        </div>
      );
    case 'offline':
      return (
        <div style={{ ...styles.banner, ...styles.warning }} role="status">
          <strong>Static demo</strong> — no simulation backend. Bundled examples and
          the Design tab run in the browser (four-bars, slider-cranks); synthesis,
          optimization and export need the Python server. {runLocally}
        </div>
      );
    default:
      return null;
  }
}
