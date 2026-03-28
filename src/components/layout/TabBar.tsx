/**
 * Horizontal tab bar for switching between app sections.
 */

import { useEditorStore } from '../../stores/editorStore';
import type { AppTab } from '../../types/mechanism';

const TABS: { id: AppTab; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'examples', label: 'Examples' },
  { id: 'synthesis', label: 'Synthesis' },
  { id: 'optimize', label: 'Optimize' },
];

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    borderBottom: '1px solid #30363d',
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    background: 'transparent',
    color: '#8b949e',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: '#58a6ff',
    borderBottomColor: '#58a6ff',
  },
};

export function TabBar() {
  const activeTab = useEditorStore((s) => s.activeTab);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);

  return (
    <div style={styles.container}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          style={{
            ...styles.tab,
            ...(activeTab === tab.id ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
