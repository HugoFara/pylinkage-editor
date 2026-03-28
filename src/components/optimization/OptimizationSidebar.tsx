/**
 * Sidebar for the Optimization tab.
 * Objective selector, algorithm config, run button, and results list.
 */

import { useOptimizationStore } from '../../stores/optimizationStore';
import { useMechanismStore, resetCounters } from '../../stores/mechanismStore';
import { useEditorStore } from '../../stores/editorStore';
import { optimizationApi, mechanismApi, simulationApi } from '../../api/client';
import type { AlgorithmType, ObjectiveType } from '../../types/optimization';

const OBJECTIVES: {
  id: ObjectiveType;
  label: string;
  description: string;
  defaultMinimize: boolean;
}[] = [
  {
    id: 'x_extent',
    label: 'X Extent',
    description: 'Horizontal extent (stride) of the path.',
    defaultMinimize: false,
  },
  {
    id: 'y_extent',
    label: 'Y Extent',
    description: 'Vertical extent of the path.',
    defaultMinimize: false,
  },
  {
    id: 'path_length',
    label: 'Path Length',
    description: 'Total path length traced by the joint.',
    defaultMinimize: false,
  },
  {
    id: 'bounding_box_area',
    label: 'Bounding Box',
    description: 'Bounding box area of the path.',
    defaultMinimize: true,
  },
  {
    id: 'target_path',
    label: 'Target Path',
    description: 'Minimize distance to target points on the canvas.',
    defaultMinimize: true,
  },
];

const ALGORITHMS: { id: AlgorithmType; label: string; description: string }[] =
  [
    {
      id: 'pso',
      label: 'PSO',
      description: 'Particle Swarm Optimization (global)',
    },
    {
      id: 'differential_evolution',
      label: 'Diff. Evol.',
      description: 'Differential Evolution (global)',
    },
    {
      id: 'nelder_mead',
      label: 'Nelder-Mead',
      description: 'Simplex local optimizer',
    },
    {
      id: 'grid_search',
      label: 'Grid Search',
      description: 'Exhaustive grid search',
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
    flexWrap: 'wrap' as const,
  },
  modeButton: {
    padding: '6px 8px',
    border: '1px solid #30363d',
    borderRadius: '6px',
    background: 'transparent',
    color: '#8b949e',
    fontSize: '11px',
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
  inputRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginTop: '6px',
  },
  label: {
    fontSize: '12px',
    color: '#e6edf3',
    minWidth: '80px',
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
  noMechanism: {
    fontSize: '13px',
    color: '#8b949e',
    padding: '16px',
    textAlign: 'center' as const,
    lineHeight: 1.6,
  },
};

function AlgorithmParamsSection() {
  const algorithmType = useOptimizationStore((s) => s.algorithmType);

  const psoParticles = useOptimizationStore((s) => s.psoParticles);
  const setPsoParticles = useOptimizationStore((s) => s.setPsoParticles);
  const psoIterations = useOptimizationStore((s) => s.psoIterations);
  const setPsoIterations = useOptimizationStore((s) => s.setPsoIterations);

  const deIterations = useOptimizationStore((s) => s.deIterations);
  const setDeIterations = useOptimizationStore((s) => s.setDeIterations);
  const dePopulation = useOptimizationStore((s) => s.dePopulation);
  const setDePopulation = useOptimizationStore((s) => s.setDePopulation);

  const nmIterations = useOptimizationStore((s) => s.nmIterations);
  const setNmIterations = useOptimizationStore((s) => s.setNmIterations);

  const gsDivisions = useOptimizationStore((s) => s.gsDivisions);
  const setGsDivisions = useOptimizationStore((s) => s.setGsDivisions);
  const gsResults = useOptimizationStore((s) => s.gsResults);
  const setGsResults = useOptimizationStore((s) => s.setGsResults);

  switch (algorithmType) {
    case 'pso':
      return (
        <>
          <div style={styles.inputRow}>
            <span style={styles.label}>Particles</span>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={500}
              value={psoParticles}
              onChange={(e) => setPsoParticles(parseInt(e.target.value) || 30)}
            />
          </div>
          <div style={styles.inputRow}>
            <span style={styles.label}>Iterations</span>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={5000}
              value={psoIterations}
              onChange={(e) => setPsoIterations(parseInt(e.target.value) || 100)}
            />
          </div>
        </>
      );
    case 'differential_evolution':
      return (
        <>
          <div style={styles.inputRow}>
            <span style={styles.label}>Generations</span>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={5000}
              value={deIterations}
              onChange={(e) => setDeIterations(parseInt(e.target.value) || 200)}
            />
          </div>
          <div style={styles.inputRow}>
            <span style={styles.label}>Pop. size</span>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={100}
              value={dePopulation}
              onChange={(e) => setDePopulation(parseInt(e.target.value) || 15)}
            />
          </div>
        </>
      );
    case 'nelder_mead':
      return (
        <div style={styles.inputRow}>
          <span style={styles.label}>Iterations</span>
          <input
            style={styles.input}
            type="number"
            min={1}
            max={50000}
            value={nmIterations}
            onChange={(e) => setNmIterations(parseInt(e.target.value) || 1000)}
          />
        </div>
      );
    case 'grid_search':
      return (
        <>
          <div style={styles.inputRow}>
            <span style={styles.label}>Divisions</span>
            <input
              style={styles.input}
              type="number"
              min={2}
              max={20}
              value={gsDivisions}
              onChange={(e) => setGsDivisions(parseInt(e.target.value) || 5)}
            />
          </div>
          <div style={styles.inputRow}>
            <span style={styles.label}>Results</span>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={50}
              value={gsResults}
              onChange={(e) => setGsResults(parseInt(e.target.value) || 5)}
            />
          </div>
        </>
      );
  }
}

export function OptimizationSidebar() {
  const mechanism = useMechanismStore((s) => s.mechanism);

  const objectiveType = useOptimizationStore((s) => s.objectiveType);
  const setObjectiveType = useOptimizationStore((s) => s.setObjectiveType);
  const jointIndex = useOptimizationStore((s) => s.jointIndex);
  const setJointIndex = useOptimizationStore((s) => s.setJointIndex);
  const minimize = useOptimizationStore((s) => s.minimize);
  const setMinimize = useOptimizationStore((s) => s.setMinimize);

  const targetPoints = useOptimizationStore((s) => s.targetPoints);
  const removeTargetPoint = useOptimizationStore((s) => s.removeTargetPoint);
  const clearTargetPoints = useOptimizationStore((s) => s.clearTargetPoints);

  const algorithmType = useOptimizationStore((s) => s.algorithmType);
  const setAlgorithmType = useOptimizationStore((s) => s.setAlgorithmType);
  const boundsFactor = useOptimizationStore((s) => s.boundsFactor);
  const setBoundsFactor = useOptimizationStore((s) => s.setBoundsFactor);

  const results = useOptimizationStore((s) => s.results);
  const setResults = useOptimizationStore((s) => s.setResults);
  const selectedResultIndex = useOptimizationStore(
    (s) => s.selectedResultIndex
  );
  const selectResult = useOptimizationStore((s) => s.selectResult);
  const isRunning = useOptimizationStore((s) => s.isRunning);
  const setIsRunning = useOptimizationStore((s) => s.setIsRunning);
  const error = useOptimizationStore((s) => s.error);
  const setError = useOptimizationStore((s) => s.setError);
  const buildAlgorithmParams = useOptimizationStore(
    (s) => s.buildAlgorithmParams
  );

  const setMechanism = useMechanismStore((s) => s.setMechanism);
  const setLoci = useMechanismStore((s) => s.setLoci);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);

  if (!mechanism) {
    return (
      <div style={styles.noMechanism}>
        Load a mechanism in the Design tab first, then switch here to optimize
        it.
      </div>
    );
  }

  const joints = mechanism.joints;
  const objectiveInfo = OBJECTIVES.find((o) => o.id === objectiveType)!;

  // Resolve the actual joint index (-1 = last joint)
  const resolvedJointIndex =
    jointIndex < 0 ? Math.max(0, joints.length - 1) : jointIndex;

  const canRun =
    !isRunning &&
    mechanism.is_buildable &&
    joints.length > 0 &&
    (objectiveType !== 'target_path' || targetPoints.length >= 2);

  const handleRun = async () => {
    setIsRunning(true);
    setResults(null);
    setError(null);
    try {
      const mechDict = {
        name: mechanism.name,
        joints: mechanism.joints,
        links: mechanism.links,
        ground: mechanism.ground,
      };
      const response = await optimizationApi.optimize({
        mechanism: mechDict,
        objective: {
          type: objectiveType,
          joint_index: resolvedJointIndex,
          ...(objectiveType === 'target_path'
            ? { target_points: targetPoints.map((p) => [p.x, p.y]) }
            : {}),
        },
        algorithm: buildAlgorithmParams(),
        minimize,
        bounds_factor: boundsFactor,
      });
      setResults(response);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSendToDesign = async () => {
    if (selectedResultIndex === null || !results) return;
    const mechDict = results.results[selectedResultIndex]?.mechanism_dict;
    if (!mechDict) return;

    try {
      const created = await mechanismApi.create(mechDict);
      resetCounters();
      setMechanism(created);

      // Auto-simulate
      try {
        const simResult = await simulationApi.simulate(created.id);
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
      {/* Objective selector */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Objective</div>
        <div style={styles.modeButtons}>
          {OBJECTIVES.map((o) => (
            <button
              key={o.id}
              style={{
                ...styles.modeButton,
                ...(objectiveType === o.id ? styles.modeButtonActive : {}),
              }}
              onClick={() => {
                setObjectiveType(o.id);
                setMinimize(o.defaultMinimize);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p style={{ ...styles.description, marginTop: '8px' }}>
          {objectiveInfo.description}
        </p>

        {/* Joint selector */}
        <div style={styles.inputRow}>
          <span style={styles.label}>Joint</span>
          <select
            style={{
              ...styles.input,
              width: '140px',
              cursor: 'pointer',
            }}
            value={resolvedJointIndex}
            onChange={(e) => setJointIndex(parseInt(e.target.value))}
          >
            {joints.map((j, i) => (
              <option key={j.id} value={i}>
                {j.name || j.id} ({j.type})
              </option>
            ))}
          </select>
        </div>

        <label style={{ ...styles.checkbox, marginTop: '8px' }}>
          <input
            type="checkbox"
            checked={minimize}
            onChange={(e) => setMinimize(e.target.checked)}
          />
          Minimize (instead of maximize)
        </label>
      </div>

      {/* Target points (only for target_path) */}
      {objectiveType === 'target_path' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            Target Points ({targetPoints.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {targetPoints.map((p, i) => (
              <div key={i} style={styles.pointItem}>
                <span>
                  <span style={styles.pointIndex}>{i + 1}</span>
                  ({p.x.toFixed(0)}, {p.y.toFixed(0)})
                </span>
                <button
                  style={styles.deleteButton}
                  onClick={() => removeTargetPoint(i)}
                >
                  x
                </button>
              </div>
            ))}
            {targetPoints.length > 0 && (
              <button style={styles.clearButton} onClick={clearTargetPoints}>
                Clear all
              </button>
            )}
            {targetPoints.length < 2 && (
              <p style={styles.description}>
                Need at least 2 points. Click on the canvas to add.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Algorithm selector */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Algorithm</div>
        <div style={styles.modeButtons}>
          {ALGORITHMS.map((a) => (
            <button
              key={a.id}
              style={{
                ...styles.modeButton,
                ...(algorithmType === a.id ? styles.modeButtonActive : {}),
              }}
              onClick={() => setAlgorithmType(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p style={{ ...styles.description, marginTop: '8px' }}>
          {ALGORITHMS.find((a) => a.id === algorithmType)!.description}
        </p>
        <AlgorithmParamsSection />
        <div style={styles.inputRow}>
          <span style={styles.label}>Bounds x</span>
          <input
            style={styles.input}
            type="number"
            min={1.1}
            max={20}
            step={0.5}
            value={boundsFactor}
            onChange={(e) =>
              setBoundsFactor(parseFloat(e.target.value) || 5.0)
            }
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
        {isRunning ? 'Optimizing...' : 'Run Optimization'}
      </button>

      {!mechanism.is_buildable && (
        <p style={styles.error}>
          Mechanism is not buildable. Fix it in the Design tab first.
        </p>
      )}

      {/* Error */}
      {error && <p style={styles.error}>{error}</p>}

      {/* Results */}
      {results && (
        <div>
          <div style={styles.sectionTitle}>
            Results ({results.results.length}){' '}
            {results.best_score !== null && (
              <span style={{ color: '#3fb950' }}>
                best: {results.best_score.toFixed(2)}
              </span>
            )}
          </div>

          {results.warnings.map((w, i) => (
            <p key={i} style={styles.warning}>
              {w}
            </p>
          ))}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              marginTop: '8px',
            }}
          >
            {results.results.map((res, i) => (
              <div
                key={i}
                style={{
                  ...styles.resultItem,
                  ...(selectedResultIndex === i
                    ? styles.resultItemSelected
                    : {}),
                }}
                onClick={() => selectResult(i)}
              >
                <span>
                  <span style={styles.pointIndex}>#{i + 1}</span>
                  score={res.score.toFixed(2)}
                </span>
                {!res.mechanism_dict && (
                  <span style={{ color: '#d29922', fontSize: '10px' }}>
                    no preview
                  </span>
                )}
              </div>
            ))}
          </div>

          {selectedResultIndex !== null &&
            results.results[selectedResultIndex]?.mechanism_dict && (
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
