import { AppShell } from './components/layout/AppShell';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAutoResimulation } from './hooks/useAutoResimulation';
import { useStaticDemo } from './hooks/useStaticDemo';

function App() {
  // Enable keyboard shortcuts globally
  useKeyboardShortcuts();
  // Re-simulate after structural edits if loci were previously loaded
  useAutoResimulation();
  // Without a backend, open on the tab that works client-side
  useStaticDemo();

  return <AppShell />;
}

export default App;
