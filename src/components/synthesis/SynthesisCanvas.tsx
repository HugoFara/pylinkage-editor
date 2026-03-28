/**
 * Canvas for the Synthesis tab.
 * Click to add precision points (path mode) or poses (motion mode).
 * Previews the selected or hovered solution geometry.
 * Supports zoom (wheel), pan (middle-click drag), and dynamic grid.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text, Arrow, Group } from 'react-konva';
import type Konva from 'konva';
import { useSynthesisStore } from '../../stores/synthesisStore';
import type { FourBarSolutionDTO, Position } from '../../types/mechanism';

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_SENSITIVITY = 0.001;

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
  tickLabel: '#484f58',
};

/** Pick a "nice" grid spacing in canvas units for the current zoom level. */
function computeGridSpacing(scale: number): number {
  const idealCanvasSpacing = 80 / scale;
  const niceSteps = [10, 25, 50, 100, 200, 500, 1000, 2000, 5000];
  for (const step of niceSteps) {
    if (step >= idealCanvasSpacing) return step;
  }
  return niceSteps[niceSteps.length - 1];
}

export function SynthesisCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);

  const mode = useSynthesisStore((s) => s.mode);
  const precisionPoints = useSynthesisStore((s) => s.precisionPoints);
  const addPoint = useSynthesisStore((s) => s.addPoint);
  const poses = useSynthesisStore((s) => s.poses);
  const addPose = useSynthesisStore((s) => s.addPose);
  const results = useSynthesisStore((s) => s.results);
  const selectedSolutionIndex = useSynthesisStore(
    (s) => s.selectedSolutionIndex
  );
  const hoveredSolutionIndex = useSynthesisStore(
    (s) => s.hoveredSolutionIndex
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
      x: (screenX - dimensions.width / 2 - panOffset.x) / scale,
      y: (dimensions.height / 2 + panOffset.y - screenY) / scale,
    }),
    [dimensions, scale, panOffset]
  );

  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number): Position => ({
      x: canvasX * scale + dimensions.width / 2 + panOffset.x,
      y: dimensions.height / 2 - canvasY * scale + panOffset.y,
    }),
    [dimensions, scale, panOffset]
  );

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const canvasPos = screenToCanvas(pos.x, pos.y);

    if (mode === 'path') {
      addPoint(canvasPos);
    } else if (mode === 'motion') {
      addPose({ ...canvasPos, angle: 0 });
    }
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const delta = -e.evt.deltaY * ZOOM_SENSITIVITY;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (1 + delta)));

    // Keep the point under cursor fixed
    const canvasPos = screenToCanvas(pos.x, pos.y);
    const newPanX = pos.x - dimensions.width / 2 - canvasPos.x * newScale;
    const newPanY = dimensions.height / 2 - pos.y + canvasPos.y * newScale;

    setScale(newScale);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Middle mouse button for panning
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      setIsPanning(true);
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning && lastPanPos.current) {
      const dx = e.evt.clientX - lastPanPos.current.x;
      const dy = e.evt.clientY - lastPanPos.current.y;
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y - dy }));
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) {
      setIsPanning(false);
      lastPanPos.current = null;
    }
  };

  // Dynamic grid
  const gridSpacing = computeGridSpacing(scale);
  const gridLines: JSX.Element[] = [];

  // Visible canvas range
  const leftCanvas = (0 - dimensions.width / 2 - panOffset.x) / scale;
  const rightCanvas = (dimensions.width - dimensions.width / 2 - panOffset.x) / scale;
  const topCanvas = (dimensions.height / 2 + panOffset.y - 0) / scale;
  const bottomCanvas = (dimensions.height / 2 + panOffset.y - dimensions.height) / scale;

  const startX = Math.floor(leftCanvas / gridSpacing) * gridSpacing;
  const endX = Math.ceil(rightCanvas / gridSpacing) * gridSpacing;
  const startY = Math.floor(bottomCanvas / gridSpacing) * gridSpacing;
  const endY = Math.ceil(topCanvas / gridSpacing) * gridSpacing;

  for (let cx = startX; cx <= endX; cx += gridSpacing) {
    const screen = canvasToScreen(cx, 0);
    const isAxis = Math.abs(cx) < gridSpacing * 0.01;
    gridLines.push(
      <Line
        key={`gv${cx}`}
        points={[screen.x, 0, screen.x, dimensions.height]}
        stroke={isAxis ? COLORS.gridAxis : COLORS.grid}
        strokeWidth={isAxis ? 1.5 : 0.5}
      />
    );
    if (!isAxis) {
      gridLines.push(
        <Text
          key={`tvx${cx}`}
          x={screen.x + 3}
          y={canvasToScreen(0, 0).y + 4}
          text={String(cx)}
          fontSize={10}
          fill={COLORS.tickLabel}
        />
      );
    }
  }
  for (let cy = startY; cy <= endY; cy += gridSpacing) {
    const screen = canvasToScreen(0, cy);
    const isAxis = Math.abs(cy) < gridSpacing * 0.01;
    gridLines.push(
      <Line
        key={`gh${cy}`}
        points={[0, screen.y, dimensions.width, screen.y]}
        stroke={isAxis ? COLORS.gridAxis : COLORS.grid}
        strokeWidth={isAxis ? 1.5 : 0.5}
      />
    );
    if (!isAxis) {
      gridLines.push(
        <Text
          key={`tvy${cy}`}
          x={canvasToScreen(0, 0).x + 4}
          y={screen.y - 12}
          text={String(cy)}
          fontSize={10}
          fill={COLORS.tickLabel}
        />
      );
    }
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

  // Determine which solution to preview: selected takes priority, else hovered
  const previewIndex = selectedSolutionIndex ?? hoveredSolutionIndex;
  const isHoverPreview = previewIndex !== null && selectedSolutionIndex === null;

  // Render solution preview
  let solutionElements: JSX.Element[] = [];
  if (
    results &&
    previewIndex !== null &&
    results.solutions[previewIndex]
  ) {
    const sol: FourBarSolutionDTO = results.solutions[previewIndex];
    const A = canvasToScreen(sol.ground_pivot_a[0], sol.ground_pivot_a[1]);
    const B = canvasToScreen(sol.crank_pivot_b[0], sol.crank_pivot_b[1]);
    const C = canvasToScreen(sol.coupler_pivot_c[0], sol.coupler_pivot_c[1]);
    const D = canvasToScreen(sol.ground_pivot_d[0], sol.ground_pivot_d[1]);
    const opacity = isHoverPreview ? 0.5 : 1.0;

    solutionElements = [
      // Ground link A-D
      <Line
        key="sol-ground"
        points={[A.x, A.y, D.x, D.y]}
        stroke={COLORS.groundPivot}
        strokeWidth={4}
        dash={[8, 4]}
        opacity={opacity}
      />,
      // Crank A-B
      <Line
        key="sol-crank"
        points={[A.x, A.y, B.x, B.y]}
        stroke={COLORS.crankPivot}
        strokeWidth={3}
        opacity={opacity}
      />,
      // Coupler B-C
      <Line
        key="sol-coupler"
        points={[B.x, B.y, C.x, C.y]}
        stroke={COLORS.couplerPivot}
        strokeWidth={3}
        opacity={opacity}
      />,
      // Rocker D-C
      <Line
        key="sol-rocker"
        points={[D.x, D.y, C.x, C.y]}
        stroke={COLORS.link}
        strokeWidth={3}
        opacity={opacity}
      />,
      // Pivots
      <Circle key="sol-A" x={A.x} y={A.y} radius={PIVOT_RADIUS} fill={COLORS.groundPivot} opacity={opacity} />,
      <Circle key="sol-D" x={D.x} y={D.y} radius={PIVOT_RADIUS} fill={COLORS.groundPivot} opacity={opacity} />,
      <Circle key="sol-B" x={B.x} y={B.y} radius={PIVOT_RADIUS} fill={COLORS.crankPivot} opacity={opacity} />,
      <Circle key="sol-C" x={C.x} y={C.y} radius={PIVOT_RADIUS} fill={COLORS.couplerPivot} opacity={opacity} />,
      // Labels
      <Text key="sol-lA" x={A.x + 10} y={A.y - 6} text="A" fontSize={12} fill={COLORS.label} fontStyle="bold" opacity={opacity} />,
      <Text key="sol-lB" x={B.x + 10} y={B.y - 6} text="B" fontSize={12} fill={COLORS.label} fontStyle="bold" opacity={opacity} />,
      <Text key="sol-lC" x={C.x + 10} y={C.y - 6} text="C" fontSize={12} fill={COLORS.label} fontStyle="bold" opacity={opacity} />,
      <Text key="sol-lD" x={D.x + 10} y={D.y - 6} text="D" fontSize={12} fill={COLORS.label} fontStyle="bold" opacity={opacity} />,
    ];

    // Render coupler point P if present
    if (sol.coupler_point) {
      const P = canvasToScreen(sol.coupler_point[0], sol.coupler_point[1]);
      solutionElements.push(
        <Circle key="sol-P" x={P.x} y={P.y} radius={PIVOT_RADIUS + 2} fill={COLORS.precisionPoint} opacity={opacity} />,
        <Text key="sol-lP" x={P.x + 10} y={P.y - 6} text="P" fontSize={12} fill={COLORS.precisionPoint} fontStyle="bold" opacity={opacity} />,
      );
    }
  }

  // Instruction text
  const instruction =
    mode === 'path'
      ? 'Click to place precision points · Scroll to zoom · Middle-click to pan'
      : mode === 'motion'
        ? 'Click to place poses · Scroll to zoom · Middle-click to pan'
        : 'Use sidebar to enter angle pairs';

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.evt.preventDefault()}
        style={{ cursor: isPanning ? 'grabbing' : mode === 'function' ? 'default' : 'crosshair' }}
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

      {/* Zoom indicator */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          background: 'rgba(22, 27, 34, 0.8)',
          borderRadius: '4px',
          color: '#8b949e',
          fontSize: '11px',
          pointerEvents: 'none',
        }}
      >
        {Math.round(scale * 100)}%
      </div>

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
