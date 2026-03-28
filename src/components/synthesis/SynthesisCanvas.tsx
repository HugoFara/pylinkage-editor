/**
 * Canvas for the Synthesis tab.
 * Click to add precision points (path mode) or poses (motion mode).
 * Previews the selected solution geometry.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text, Arrow, Group } from 'react-konva';
import type Konva from 'konva';
import { useSynthesisStore } from '../../stores/synthesisStore';
import type { FourBarSolutionDTO, Position } from '../../types/mechanism';

const GRID_SIZE = 50;
const POINT_RADIUS = 8;
const PIVOT_RADIUS = 6;

const COLORS = {
  precisionPoint: '#f0883e',
  pose: '#a371f7',
  groundPivot: '#f85149',
  crankPivot: '#d29922',
  couplerPivot: '#58a6ff',
  link: '#8b949e',
  grid: '#21262d',
  gridAxis: '#30363d',
  label: '#e6edf3',
};

export function SynthesisCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const mode = useSynthesisStore((s) => s.mode);
  const precisionPoints = useSynthesisStore((s) => s.precisionPoints);
  const addPoint = useSynthesisStore((s) => s.addPoint);
  const poses = useSynthesisStore((s) => s.poses);
  const addPose = useSynthesisStore((s) => s.addPose);
  const results = useSynthesisStore((s) => s.results);
  const selectedSolutionIndex = useSynthesisStore(
    (s) => s.selectedSolutionIndex
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
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const canvasPos = screenToCanvas(pos.x, pos.y);

    if (mode === 'path') {
      addPoint(canvasPos);
    } else if (mode === 'motion') {
      // Default angle of 0; user can change in sidebar later
      addPose({ ...canvasPos, angle: 0 });
    }
  };

  // Grid lines
  const gridLines: JSX.Element[] = [];
  const gridCountX = Math.ceil(dimensions.width / GRID_SIZE) + 1;
  const gridCountY = Math.ceil(dimensions.height / GRID_SIZE) + 1;
  const offsetX = dimensions.width / 2;
  const offsetY = dimensions.height / 2;

  for (let i = -gridCountX; i <= gridCountX; i++) {
    const x = offsetX + i * GRID_SIZE;
    const isAxis = i === 0;
    gridLines.push(
      <Line
        key={`gv${i}`}
        points={[x, 0, x, dimensions.height]}
        stroke={isAxis ? COLORS.gridAxis : COLORS.grid}
        strokeWidth={isAxis ? 1 : 0.5}
      />
    );
  }
  for (let i = -gridCountY; i <= gridCountY; i++) {
    const y = offsetY + i * GRID_SIZE;
    const isAxis = i === 0;
    gridLines.push(
      <Line
        key={`gh${i}`}
        points={[0, y, dimensions.width, y]}
        stroke={isAxis ? COLORS.gridAxis : COLORS.grid}
        strokeWidth={isAxis ? 1 : 0.5}
      />
    );
  }

  // Render precision points
  const pointElements = precisionPoints.map((p, i) => {
    const screen = canvasToScreen(p.x, p.y);
    return (
      <Group key={`pp${i}`}>
        <Circle
          x={screen.x}
          y={screen.y}
          radius={POINT_RADIUS}
          fill={COLORS.precisionPoint}
          opacity={0.9}
        />
        <Text
          x={screen.x + 12}
          y={screen.y - 6}
          text={`P${i + 1}`}
          fontSize={12}
          fill={COLORS.label}
          fontStyle="bold"
        />
      </Group>
    );
  });

  // Render poses
  const poseElements = poses.map((p, i) => {
    const screen = canvasToScreen(p.x, p.y);
    const arrowLen = 25;
    // Arrow points in canvas-Y-up direction, but Konva is Y-down
    const endX = screen.x + arrowLen * Math.cos(-p.angle);
    const endY = screen.y + arrowLen * Math.sin(-p.angle);
    return (
      <Group key={`pose${i}`}>
        <Circle
          x={screen.x}
          y={screen.y}
          radius={POINT_RADIUS}
          fill={COLORS.pose}
          opacity={0.9}
        />
        <Arrow
          points={[screen.x, screen.y, endX, endY]}
          stroke={COLORS.pose}
          strokeWidth={2}
          pointerLength={6}
          pointerWidth={5}
          fill={COLORS.pose}
        />
        <Text
          x={screen.x + 12}
          y={screen.y - 6}
          text={`P${i + 1}`}
          fontSize={12}
          fill={COLORS.label}
          fontStyle="bold"
        />
      </Group>
    );
  });

  // Render selected solution preview
  let solutionElements: JSX.Element[] = [];
  if (
    results &&
    selectedSolutionIndex !== null &&
    results.solutions[selectedSolutionIndex]
  ) {
    const sol: FourBarSolutionDTO = results.solutions[selectedSolutionIndex];
    const A = canvasToScreen(sol.ground_pivot_a[0], sol.ground_pivot_a[1]);
    const B = canvasToScreen(sol.crank_pivot_b[0], sol.crank_pivot_b[1]);
    const C = canvasToScreen(sol.coupler_pivot_c[0], sol.coupler_pivot_c[1]);
    const D = canvasToScreen(sol.ground_pivot_d[0], sol.ground_pivot_d[1]);

    // Links
    solutionElements = [
      // Ground link A-D
      <Line
        key="sol-ground"
        points={[A.x, A.y, D.x, D.y]}
        stroke={COLORS.groundPivot}
        strokeWidth={4}
        dash={[8, 4]}
      />,
      // Crank A-B
      <Line
        key="sol-crank"
        points={[A.x, A.y, B.x, B.y]}
        stroke={COLORS.crankPivot}
        strokeWidth={3}
      />,
      // Coupler B-C
      <Line
        key="sol-coupler"
        points={[B.x, B.y, C.x, C.y]}
        stroke={COLORS.couplerPivot}
        strokeWidth={3}
      />,
      // Rocker D-C
      <Line
        key="sol-rocker"
        points={[D.x, D.y, C.x, C.y]}
        stroke={COLORS.link}
        strokeWidth={3}
      />,
      // Pivots
      <Circle key="sol-A" x={A.x} y={A.y} radius={PIVOT_RADIUS} fill={COLORS.groundPivot} />,
      <Circle key="sol-D" x={D.x} y={D.y} radius={PIVOT_RADIUS} fill={COLORS.groundPivot} />,
      <Circle key="sol-B" x={B.x} y={B.y} radius={PIVOT_RADIUS} fill={COLORS.crankPivot} />,
      <Circle key="sol-C" x={C.x} y={C.y} radius={PIVOT_RADIUS} fill={COLORS.couplerPivot} />,
      // Labels
      <Text key="sol-lA" x={A.x + 10} y={A.y - 6} text="A" fontSize={12} fill={COLORS.label} fontStyle="bold" />,
      <Text key="sol-lB" x={B.x + 10} y={B.y - 6} text="B" fontSize={12} fill={COLORS.label} fontStyle="bold" />,
      <Text key="sol-lC" x={C.x + 10} y={C.y - 6} text="C" fontSize={12} fill={COLORS.label} fontStyle="bold" />,
      <Text key="sol-lD" x={D.x + 10} y={D.y - 6} text="D" fontSize={12} fill={COLORS.label} fontStyle="bold" />,
    ];
  }

  // Instruction text
  const instruction =
    mode === 'path'
      ? 'Click to place precision points'
      : mode === 'motion'
        ? 'Click to place poses'
        : 'Use sidebar to enter angle pairs';

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleClick}
        style={{ cursor: mode === 'function' ? 'default' : 'crosshair' }}
      >
        <Layer>
          {/* Grid */}
          {gridLines}

          {/* Solution preview */}
          {solutionElements}

          {/* Points / Poses */}
          {mode === 'path' && pointElements}
          {mode === 'motion' && poseElements}
        </Layer>
      </Stage>

      {/* Overlay instruction */}
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
