/**
 * Notice shown when no Python backend answers on `/api` (the GitHub Pages demo).
 */

import { useBackendStatus } from '../../api/backend';

const REPO_URL = 'https://github.com/HugoFara/pylinkage-editor';

const styles: Record<string, React.CSSProperties> = {
  banner: {
    margin: '0 0 8px',
    padding: '8px 10px',
    borderRadius: '6px',
    background: '#3d2e00',
    border: '1px solid #9e6a03',
    color: '#e3b341',
    fontSize: '12px',
    lineHeight: 1.5,
  },
  link: {
    color: '#58a6ff',
  },
};

export function BackendBanner() {
  const backend = useBackendStatus();
  if (backend !== 'offline') return null;

  return (
    <div style={styles.banner} role="status">
      <strong>Static demo</strong> — no simulation backend. Bundled examples and
      the Design tab run in the browser (four-bars, slider-cranks); synthesis,
      optimization and export need the Python server.{' '}
      <a style={styles.link} href={`${REPO_URL}#getting-started`} target="_blank" rel="noreferrer">
        Run it locally
      </a>
    </div>
  );
}
