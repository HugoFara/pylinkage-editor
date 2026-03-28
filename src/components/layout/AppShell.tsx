/**
 * Main application shell with tab-based navigation.
 * Conditionally renders sidebar content and main area per active tab.
 */

import { useEditorStore } from '../../stores/editorStore';
import { TabBar } from './TabBar';
import { DesignSidebar } from './DesignSidebar';
import { LinkageCanvas } from '../canvas/LinkageCanvas';
import { SynthesisSidebar } from '../synthesis/SynthesisSidebar';
import { SynthesisCanvas } from '../synthesis/SynthesisCanvas';
import { OptimizationSidebar } from '../optimization/OptimizationSidebar';
import { OptimizationCanvas } from '../optimization/OptimizationCanvas';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
  },
  sidebar: {
    width: '300px',
    minWidth: '300px',
    height: '100%',
    borderRight: '1px solid #30363d',
    background: '#161b22',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '12px 16px 0',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#58a6ff',
  },
  subtitle: {
    fontSize: '12px',
    color: '#8b949e',
    margin: '2px 0 8px',
  },
  sidebarContent: {
    flex: 1,
    overflow: 'auto',
  },
  main: {
    flex: 1,
    height: '100%',
    position: 'relative',
    background: '#0d1117',
  },
};

export function AppShell() {
  const activeTab = useEditorStore((s) => s.activeTab);

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h1 style={styles.title}>Pylinkage</h1>
          <p style={styles.subtitle}>Planar linkage design tool</p>
        </div>
        <TabBar />
        <div style={styles.sidebarContent}>
          {activeTab === 'design' && <DesignSidebar />}
          {activeTab === 'synthesis' && <SynthesisSidebar />}
          {activeTab === 'optimize' && <OptimizationSidebar />}
        </div>
      </aside>
      <main style={styles.main}>
        {activeTab === 'design' && <LinkageCanvas />}
        {activeTab === 'synthesis' && <SynthesisCanvas />}
        {activeTab === 'optimize' && <OptimizationCanvas />}
      </main>
    </div>
  );
}
