/**
 * Canvas for the Optimization tab.
 * Shows the current mechanism, target points (for target_path objective),
 * and previews the selected optimization result.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text, Group } from 'react-konva';
import type Konva from 'konva';
import { useOptimizationStore } from '../../stores/optimizationStore';
import { useMechanismStore } from '../../stores/mechanismStore';
import type { MechanismDict, Position } from '../../types/mechanism';
import { LINK_COLORS } from '../../types/mechanism';

const GRID_SIZE = 50;
const POINT_RADIUS = 8;
const JOINT_RADIUS = 5;

const COLORS = {
  targetPoint: '#f0883e',
  grid: '#21262d',
  gridAxis: '#30363d',
  label: '#e6edf3',
  originalLink: '#30363d',
  originalJoint: '#484f58',
  resultLink: '#58a6ff',
  resultJoint: '#58a6ff',
};

function renderMechanism(
  mech: MechanismDict,
  canvasToScreen: (x: number, y: number) => Position,
  prefix: string,
  linkColor: string | null,
  jointColor: string,
  linkWidth: number,
  opacity: number
): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const jointMap = new Map(mech.joints.map((j) => [j.id, j]));

  // Render links
  mech.links.forEach((link) => {
    const jointPositions = link.joints
      .map((jid) => jointMap.get(jid))
      .filter((j) => j && j.position[0] != null && j.position[1] != null);

    if (jointPositions.length >= 2) {
      const points: number[] = [];
      for (const j of jointPositions) {
        const screen = canvasToScreen(j!.position[0]!, j!.position[1]!);
        points.push(screen.x, screen.y);
      }
      // Close the polygon if more than 2 joints
      if (jointPositions.length > 2) {
        const first = canvasToScreen(
          jointPositions[0]!.position[0]!,
          jointPositions[0]!.position[1]!
        );
        points.push(first.x, first.y);
      }
      const color =
        linkColor ?? LINK_COLORS[link.type as keyof typeof LINK_COLORS] ?? '#58a6ff';
      elements.push(
        <Line
          key={`${prefix}-link-${link.id}`}
          points={points}
          stroke={color}
          strokeWidth={linkWidth}
          opacity={opacity}
        />
      );
    }
  });

  // Render joints
  mech.joints.forEach((j) => {
    if (j.position[0] == null || j.position[1] == null) return;
    const screen = canvasToScreen(j.position[0], j.position[1]);
    elements.push(
      <Circle
        key={`${prefix}-joint-${j.id}`}
        x={screen.x}
        y={screen.y}
        radius={JOINT_RADIUS}
        fill={jointColor}
        opacity={opacity}
      />
    );
  });

  return elements;
}

export function OptimizationCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const mechanism = useMechanismStore((s) => s.mechanism);
  const objectiveType = useOptimizationStore((s) => s.objectiveType);
  const targetPoints = useOptimizationStore((s) => s.targetPoints);
  const addTargetPoint = useOptimizationStore((s) => s.addTargetPoint);
  const results = useOptimizationStore((s) => s.results);
  const selectedResultIndex = useOptimizationStore(
    (s) => s.selectedResultIndex
  );

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Position => ({
      x: screenX - dimensions.width / 2,
      y: dimensions.height / 2 - screenY,
    }),
    [dimensions]
  );

  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number): Position => ({
      x: canvasX + dimensions.width / 2,
      y: dimensions.height / 2 - canvasY,
    }),
    [dimensions]
  );

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (objectiveType !== 'target_path') return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    addTargetPoint(screenToCanvas(pos.x, pos.y));
  };

  // Grid
  const gridLines: JSX.Element[] = [];
  const gridCountX = Math.ceil(dimensions.width / GRID_SIZE) + 1;
  const gridCountY = Math.ceil(dimensions.height / GRID_SIZE) + 1;
  const offsetX = dimensions.width / 2;
  const offsetY = dimensions.height / 2;

  for (let i = -gridCountX; i <= gridCountX; i++) {
    const x = offsetX + i * GRID_SIZE;
    gridLines.push(
      <Line
        key={`gv${i}`}
        points={[x, 0, x, dimensions.height]}
        stroke={i === 0 ? COLORS.gridAxis : COLORS.grid}
        strokeWidth={i === 0 ? 1 : 0.5}
      />
    );
  }
  for (let i = -gridCountY; i <= gridCountY; i++) {
    const y = offsetY + i * GRID_SIZE;
    gridLines.push(
      <Line
        key={`gh${i}`}
        points={[0, y, dimensions.width, y]}
        stroke={i === 0 ? COLORS.gridAxis : COLORS.grid}
        strokeWidth={i === 0 ? 1 : 0.5}
      />
    );
  }

  // Current mechanism (dimmed)
  const originalElements = mechanism
    ? renderMechanism(
        mechanism,
        canvasToScreen,
        'orig',
        COLORS.originalLink,
        COLORS.originalJoint,
        3,
        0.5
      )
    : [];

  // Selected result (bright)
  let resultElements: JSX.Element[] = [];
  if (results && selectedResultIndex !== null) {
    const resultMech = results.results[selectedResultIndex]?.mechanism_dict;
    if (resultMech) {
      resultElements = renderMechanism(
        resultMech,
        canvasToScreen,
        'result',
        null, // use per-link-type colors
        COLORS.resultJoint,
        5,
        1.0
      );
    }
  }

  // Target points
  const pointElements = targetPoints.map((p, i) => {
    const screen = canvasToScreen(p.x, p.y);
    return (
      <Group key={`tp${i}`}>
        <Circle
          x={screen.x}
          y={screen.y}
          radius={POINT_RADIUS}
          fill={COLORS.targetPoint}
          opacity={0.9}
        />
        <Text
          x={screen.x + 12}
          y={screen.y - 6}
          text={`T${i + 1}`}
          fontSize={12}
          fill={COLORS.label}
          fontStyle="bold"
        />
      </Group>
    );
  });

  // Instruction overlay
  let instruction = 'Select an objective and run optimization';
  if (!mechanism) {
    instruction = 'Load a mechanism in the Design tab first';
  } else if (objectiveType === 'target_path') {
    instruction = 'Click to place target points for path matching';
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleClick}
        style={{
          cursor: objectiveType === 'target_path' ? 'crosshair' : 'default',
        }}
      >
        <Layer>
          {gridLines}
          {originalElements}
          {resultElements}
          {objectiveType === 'target_path' && pointElements}
        </Layer>
      </Stage>

      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 16px',
          background: 'rgba(22, 27, 34, 0.9)',
          borderRadius: '6px',
          border: '1px solid #30363d',
          color: '#8b949e',
          fontSize: '13px',
          pointerEvents: 'none',
        }}
      >
        {instruction}
      </div>
    </div>
  );
}
