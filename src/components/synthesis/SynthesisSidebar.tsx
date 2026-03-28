/**
 * Sidebar for the Synthesis tab.
 * Mode selector, input management, options, run button, and results list.
 */

import { useSynthesisStore } from '../../stores/synthesisStore';
import { useMechanismStore, resetCounters } from '../../stores/mechanismStore';
import { useEditorStore } from '../../stores/editorStore';
import { synthesisApi, mechanismApi, simulationApi } from '../../api/client';
import type { SynthesisMode } from '../../types/mechanism';

const MODES: { id: SynthesisMode; label: string; description: string }[] = [
  {
    id: 'path',
    label: 'Path',
    description: 'Click points on the canvas that the coupler must pass through.',
  },
  {
    id: 'function',
    label: 'Function',
    description: 'Define input/output angle pairs (in degrees).',
  },
  {
    id: 'motion',
    label: 'Motion',
    description: 'Click on the canvas to place poses (position + orientation).',
  },
];

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  section: {
    borderBottom: '1px solid #30363d',
    paddingBottom: '16px',
  },
  sectionTitle: {
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    color: '#8b949e',
    marginBottom: '8px',
    letterSpacing: '0.5px',
  },
  modeButtons: {
    display: 'flex',
    gap: '4px',
  },
  modeButton: {
    flex: 1,
    padding: '8px 4px',
    border: '1px solid #30363d',
    borderRadius: '6px',
    background: 'transparent',
    color: '#8b949e',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modeButtonActive: {
    background: '#1f6feb',
    borderColor: '#1f6feb',
    color: 'white',
  },
  description: {
    fontSize: '12px',
    color: '#8b949e',
    lineHeight: 1.5,
    margin: 0,
  },
  pointList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  pointItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 8px',
    background: '#21262d',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#e6edf3',
  },
  pointIndex: {
    color: '#58a6ff',
    fontWeight: 600,
    marginRight: '8px',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    color: '#f85149',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 4px',
  },
  clearButton: {
    padding: '4px 8px',
    border: '1px solid #30363d',
    borderRadius: '4px',
    background: 'transparent',
    color: '#8b949e',
    fontSize: '11px',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#e6edf3',
    cursor: 'pointer',
  },
  runButton: {
    padding: '10px 16px',
    borderRadius: '6px',
    border: 'none',
    background: '#238636',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
    width: '100%',
  },
  runButtonDisabled: {
    background: '#21262d',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  resultItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    background: '#21262d',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#e6edf3',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'border-color 0.15s',
  },
  resultItemSelected: {
    borderColor: '#58a6ff',
  },
  sendButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    background: '#1f6feb',
    color: 'white',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
  },
  warning: {
    fontSize: '12px',
    color: '#d29922',
    margin: 0,
  },
  error: {
    fontSize: '12px',
    color: '#f85149',
    margin: 0,
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  input: {
    width: '70px',
    padding: '4px 6px',
    borderRadius: '4px',
    border: '1px solid #30363d',
    background: '#21262d',
    color: '#e6edf3',
    fontSize: '12px',
  },
  addButton: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #30363d',
    background: 'transparent',
    color: '#58a6ff',
    fontSize: '12px',
    cursor: 'pointer',
  },
};

function AnglePairInputSection() {
  const anglePairs = useSynthesisStore((s) => s.anglePairs);
  const addAnglePair = useSynthesisStore((s) => s.addAnglePair);
  const removeAnglePair = useSynthesisStore((s) => s.removeAnglePair);
  const clearAnglePairs = useSynthesisStore((s) => s.clearAnglePairs);

  const handleAdd = () => {
    addAnglePair({ theta_in: 0, theta_out: 0 });
  };

  const handleChange = (
    index: number,
    field: 'theta_in' | 'theta_out',
    value: string
  ) => {
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return;
    // Store internally as radians, display as degrees
    const radians = (numVal * Math.PI) / 180;
    const pairs = [...anglePairs];
    pairs[index] = { ...pairs[index], [field]: radians };
    // Replace via clear + re-add (zustand immutability)
    clearAnglePairs();
    pairs.forEach((p) => addAnglePair(p));
  };

  return (
    <div style={styles.pointList}>
      {anglePairs.map((pair, i) => (
        <div key={i} style={styles.inputRow}>
          <span style={{ ...styles.pointIndex, minWidth: '16px' }}>
            {i + 1}
          </span>
          <span style={{ fontSize: '11px', color: '#8b949e' }}>In:</span>
          <input
            style={styles.input}
            type="number"
            value={Math.round((pair.theta_in * 180) / Math.PI)}
            onChange={(e) => handleChange(i, 'theta_in', e.target.value)}
          />
          <span style={{ fontSize: '11px', color: '#8b949e' }}>Out:</span>
          <input
            style={styles.input}
            type="number"
            value={Math.round((pair.theta_out * 180) / Math.PI)}
            onChange={(e) => handleChange(i, 'theta_out', e.target.value)}
          />
          <button style={styles.deleteButton} onClick={() => removeAnglePair(i)}>
            x
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={styles.addButton} onClick={handleAdd}>
          + Add pair
        </button>
        {anglePairs.length > 0 && (
          <button style={styles.clearButton} onClick={clearAnglePairs}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export function SynthesisSidebar() {
  const mode = useSynthesisStore((s) => s.mode);
  const setMode = useSynthesisStore((s) => s.setMode);
  const precisionPoints = useSynthesisStore((s) => s.precisionPoints);
  const removePoint = useSynthesisStore((s) => s.removePoint);
  const clearPoints = useSynthesisStore((s) => s.clearPoints);
  const anglePairs = useSynthesisStore((s) => s.anglePairs);
  const poses = useSynthesisStore((s) => s.poses);
  const removePose = useSynthesisStore((s) => s.removePose);
  const clearPoses = useSynthesisStore((s) => s.clearPoses);
  const requireGrashof = useSynthesisStore((s) => s.requireGrashof);
  const setRequireGrashof = useSynthesisStore((s) => s.setRequireGrashof);
  const maxSolutions = useSynthesisStore((s) => s.maxSolutions);
  const setMaxSolutions = useSynthesisStore((s) => s.setMaxSolutions);
  const results = useSynthesisStore((s) => s.results);
  const setResults = useSynthesisStore((s) => s.setResults);
  const selectedSolutionIndex = useSynthesisStore(
    (s) => s.selectedSolutionIndex
  );
  const selectSolution = useSynthesisStore((s) => s.selectSolution);
  const isRunning = useSynthesisStore((s) => s.isRunning);
  const setIsRunning = useSynthesisStore((s) => s.setIsRunning);

  const setMechanism = useMechanismStore((s) => s.setMechanism);
  const setLoci = useMechanismStore((s) => s.setLoci);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);

  const modeInfo = MODES.find((m) => m.id === mode)!;

  const canRun =
    !isRunning &&
    ((mode === 'path' && precisionPoints.length >= 3) ||
      (mode === 'function' && anglePairs.length >= 3) ||
      (mode === 'motion' && poses.length >= 3));

  const handleRun = async () => {
    setIsRunning(true);
    setResults(null);
    try {
      const options = {
        max_solutions: maxSolutions,
        require_grashof: requireGrashof,
      };
      let response;
      if (mode === 'path') {
        response = await synthesisApi.pathGeneration(precisionPoints, options);
      } else if (mode === 'function') {
        response = await synthesisApi.functionGeneration(anglePairs, {
          ...options,
          ground_length: 100,
        });
      } else {
        response = await synthesisApi.motionGeneration(poses, options);
      }
      setResults(response);
    } catch (e) {
      setResults({
        solutions: [],
        mechanism_dicts: [],
        warnings: [(e as Error).message],
        solution_count: 0,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSendToDesign = async () => {
    if (
      selectedSolutionIndex === null ||
      !results ||
      !results.mechanism_dicts[selectedSolutionIndex]
    )
      return;

    const mechDict = results.mechanism_dicts[selectedSolutionIndex];
    try {
      const mechanism = await mechanismApi.create(mechDict);
      resetCounters();
      setMechanism(mechanism);

      // Auto-simulate
      try {
        const simResult = await simulationApi.simulate(mechanism.id);
        if (simResult.is_complete) {
          setLoci(simResult.frames, simResult.joint_names);
        }
      } catch {
        // Simulation failure is non-fatal
      }

      setActiveTab('design');
    } catch (e) {
      console.error('Failed to send to design:', e);
    }
  };

  return (
    <div style={styles.container}>
      {/* Mode selector */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Synthesis Mode</div>
        <div style={styles.modeButtons}>
          {MODES.map((m) => (
            <button
              key={m.id}
              style={{
                ...styles.modeButton,
                ...(mode === m.id ? styles.modeButtonActive : {}),
              }}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p style={{ ...styles.description, marginTop: '8px' }}>
          {modeInfo.description}
        </p>
      </div>

      {/* Inputs */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          {mode === 'path'
            ? `Precision Points (${precisionPoints.length})`
            : mode === 'function'
              ? `Angle Pairs (${anglePairs.length})`
              : `Poses (${poses.length})`}
        </div>

        {mode === 'path' && (
          <div style={styles.pointList}>
            {precisionPoints.map((p, i) => (
              <div key={i} style={styles.pointItem}>
                <span>
                  <span style={styles.pointIndex}>{i + 1}</span>
                  ({p.x.toFixed(0)}, {p.y.toFixed(0)})
                </span>
                <button
                  style={styles.deleteButton}
                  onClick={() => removePoint(i)}
                >
                  x
                </button>
              </div>
            ))}
            {precisionPoints.length > 0 && (
              <button style={styles.clearButton} onClick={clearPoints}>
                Clear all
              </button>
            )}
            {precisionPoints.length < 3 && (
              <p style={styles.description}>
                Need at least 3 points. Click on the canvas to add.
              </p>
            )}
          </div>
        )}

        {mode === 'function' && <AnglePairInputSection />}

        {mode === 'motion' && (
          <div style={styles.pointList}>
            {poses.map((p, i) => (
              <div key={i} style={styles.pointItem}>
                <span>
                  <span style={styles.pointIndex}>{i + 1}</span>
                  ({p.x.toFixed(0)}, {p.y.toFixed(0)}) {Math.round((p.angle * 180) / Math.PI)}°
                </span>
                <button
                  style={styles.deleteButton}
                  onClick={() => removePose(i)}
                >
                  x
                </button>
              </div>
            ))}
            {poses.length > 0 && (
              <button style={styles.clearButton} onClick={clearPoses}>
                Clear all
              </button>
            )}
            {poses.length < 3 && (
              <p style={styles.description}>
                Need at least 3 poses. Click on the canvas to add.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Options */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Options</div>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={requireGrashof}
            onChange={(e) => setRequireGrashof(e.target.checked)}
          />
          Require Grashof (full rotation)
        </label>
        <div style={{ ...styles.inputRow, marginTop: '8px' }}>
          <span style={{ fontSize: '12px', color: '#e6edf3' }}>
            Max solutions:
          </span>
          <input
            style={{ ...styles.input, width: '50px' }}
            type="number"
            min={1}
            max={50}
            value={maxSolutions}
            onChange={(e) => setMaxSolutions(parseInt(e.target.value) || 10)}
          />
        </div>
      </div>

      {/* Run */}
      <button
        style={{
          ...styles.runButton,
          ...(!canRun ? styles.runButtonDisabled : {}),
        }}
        onClick={handleRun}
        disabled={!canRun}
      >
        {isRunning ? 'Running...' : 'Generate Linkages'}
      </button>

      {/* Results */}
      {results && (
        <div>
          <div style={styles.sectionTitle}>
            Results ({results.solution_count} solutions)
          </div>

          {results.warnings.map((w, i) => (
            <p key={i} style={styles.warning}>
              {w}
            </p>
          ))}

          <div style={{ ...styles.pointList, marginTop: '8px' }}>
            {results.solutions.map((sol, i) => (
              <div
                key={i}
                style={{
                  ...styles.resultItem,
                  ...(selectedSolutionIndex === i
                    ? styles.resultItemSelected
                    : {}),
                }}
                onClick={() => selectSolution(i)}
              >
                <span>
                  <span style={styles.pointIndex}>#{i + 1}</span>
                  crank={sol.crank_length.toFixed(1)}{' '}
                  coupler={sol.coupler_length.toFixed(1)}{' '}
                  rocker={sol.rocker_length.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          {selectedSolutionIndex !== null && (
            <button
              style={{ ...styles.sendButton, marginTop: '8px' }}
              onClick={handleSendToDesign}
            >
              Send to Design Tab
            </button>
          )}
        </div>
      )}
    </div>
  );
}
