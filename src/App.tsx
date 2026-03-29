import { AppShell } from './components/layout/AppShell';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAutoResimulation } from './hooks/useAutoResimulation';

function App() {
  // Enable keyboard shortcuts globally
  useKeyboardShortcuts();
  // Re-simulate after structural edits if loci were previously loaded
  useAutoResimulation();

  return <AppShell />;
}

export default App;
