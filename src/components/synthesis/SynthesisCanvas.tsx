/**
 * Canvas for the Synthesis tab.
 * Click to add precision points (path mode) or poses (motion mode).
 * Previews the selected or hovered solution with animation.
 * Supports zoom (wheel), pan (middle-click drag), and dynamic grid.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text, Arrow, Group } from 'react-konva';
import type Konva from 'konva';
import { useSynthesisStore } from '../../stores/synthesisStore';
import { simulationApi } from '../../api/client';
import type { Position } from '../../types/mechanism';

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_SENSITIVITY = 0.001;
const ANIMATION_FPS = 30;

const POINT_RADIUS = 8;
const PIVOT_RADIUS = 6;

const COLORS = {
  precisionPoint: '#f0883e',
  pose: '#a371f7',
  groundPivot: '#f85149',
  crankPivot: '#d29922',
  couplerPivot: '#58a6ff',
  link: '#8b949e',
  loci: '#58a6ff',
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
  const animationRef = useRef<number | null>(null);
  const lastFrameTime = useRef(0);
  // Track which solution index the current preview was fetched for
  const simulatedForIndex = useRef<number | null>(null);

  const mode = useSynthesisStore((s) => s.mode);
  const precisionPoints = useSynthesisStore((s) => s.precisionPoints);
  const addPoint = useSynthesisStore((s) => s.addPoint);
  const poses = useSynthesisStore((s) => s.poses);
  const addPose = useSynthesisStore((s) => s.addPose);
  const results = useSynthesisStore((s) => s.results);
  const selectedSolutionIndex = useSynthesisStore((s) => s.selectedSolutionIndex);
  const hoveredSolutionIndex = useSynthesisStore((s) => s.hoveredSolutionIndex);
  const previewFrames = useSynthesisStore((s) => s.previewFrames);
  const previewJointNames = useSynthesisStore((s) => s.previewJointNames);
  const previewFrame = useSynthesisStore((s) => s.previewFrame);
  const setPreview = useSynthesisStore((s) => s.setPreview);
  const clearPreview = useSynthesisStore((s) => s.clearPreview);
  const setPreviewFrame = useSynthesisStore((s) => s.setPreviewFrame);

  // Which solution to preview: selected takes priority over hovered
  const previewIndex = selectedSolutionIndex ?? hoveredSolutionIndex;

  // --- Fetch simulation when preview target changes ---
  useEffect(() => {
    if (previewIndex === null || !results || !results.mechanism_dicts[previewIndex]) {
      clearPreview();
      simulatedForIndex.current = null;
      return;
    }

    // Don't re-fetch if already simulated for this index
    if (simulatedForIndex.current === previewIndex) return;

    let cancelled = false;
    const mechDict = results.mechanism_dicts[previewIndex];

    simulationApi.simulateDirect(mechDict).then((simResult) => {
      if (cancelled) return;
      if (simResult.is_complete && simResult.frames.length > 0) {
        setPreview(simResult.frames, simResult.joint_names);
        simulatedForIndex.current = previewIndex;
      }
    }).catch(() => {
      // Simulation failed (e.g. unbuildable) — show static fallback
      if (!cancelled) {
        clearPreview();
        simulatedForIndex.current = null;
      }
    });

    return () => { cancelled = true; };
  }, [previewIndex, results, setPreview, clearPreview]);

  // --- Animation loop ---
  useEffect(() => {
    if (!previewFrames || previewFrames.length === 0) {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const frameInterval = 1000 / ANIMATION_FPS;

    const animate = (timestamp: number) => {
      if (timestamp - lastFrameTime.current >= frameInterval) {
        lastFrameTime.current = timestamp;
        const frames = useSynthesisStore.getState().previewFrames;
        if (frames) {
          const current = useSynthesisStore.getState().previewFrame;
          setPreviewFrame((current + 1) % frames.length);
        }
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [previewFrames, setPreviewFrame]);

  // --- Clear simulation cache when results change ---
  useEffect(() => {
    simulatedForIndex.current = null;
  }, [results]);

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

    const canvasPos = screenToCanvas(pos.x, pos.y);
    const newPanX = pos.x - dimensions.width / 2 - canvasPos.x * newScale;
    const newPanY = dimensions.height / 2 - pos.y + canvasPos.y * newScale;

    setScale(newScale);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
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

  // --- Dynamic grid ---
  const gridSpacing = computeGridSpacing(scale);
  const gridLines: JSX.Element[] = [];

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
      <Line key={`gv${cx}`} points={[screen.x, 0, screen.x, dimensions.height]} stroke={isAxis ? COLORS.gridAxis : COLORS.grid} strokeWidth={isAxis ? 1.5 : 0.5} />
    );
    if (!isAxis) {
      gridLines.push(
        <Text key={`tvx${cx}`} x={screen.x + 3} y={canvasToScreen(0, 0).y + 4} text={String(cx)} fontSize={10} fill={COLORS.tickLabel} />
      );
    }
  }
  for (let cy = startY; cy <= endY; cy += gridSpacing) {
    const screen = canvasToScreen(0, cy);
    const isAxis = Math.abs(cy) < gridSpacing * 0.01;
    gridLines.push(
      <Line key={`gh${cy}`} points={[0, screen.y, dimensions.width, screen.y]} stroke={isAxis ? COLORS.gridAxis : COLORS.grid} strokeWidth={isAxis ? 1.5 : 0.5} />
    );
    if (!isAxis) {
      gridLines.push(
        <Text key={`tvy${cy}`} x={canvasToScreen(0, 0).x + 4} y={screen.y - 12} text={String(cy)} fontSize={10} fill={COLORS.tickLabel} />
      );
    }
  }

  // --- Render precision points ---
  const pointElements = precisionPoints.map((p, i) => {
    const screen = canvasToScreen(p.x, p.y);
    return (
      <Group key={`pp${i}`}>
        <Circle x={screen.x} y={screen.y} radius={POINT_RADIUS} fill={COLORS.precisionPoint} opacity={0.9} />
        <Text x={screen.x + 12} y={screen.y - 6} text={`P${i + 1}`} fontSize={12} fill={COLORS.label} fontStyle="bold" />
      </Group>
    );
  });

  // --- Render poses ---
  const poseElements = poses.map((p, i) => {
    const screen = canvasToScreen(p.x, p.y);
    const arrowLen = 25;
    const ex = screen.x + arrowLen * Math.cos(-p.angle);
    const ey = screen.y + arrowLen * Math.sin(-p.angle);
    return (
      <Group key={`pose${i}`}>
        <Circle x={screen.x} y={screen.y} radius={POINT_RADIUS} fill={COLORS.pose} opacity={0.9} />
        <Arrow points={[screen.x, screen.y, ex, ey]} stroke={COLORS.pose} strokeWidth={2} pointerLength={6} pointerWidth={5} fill={COLORS.pose} />
        <Text x={screen.x + 12} y={screen.y - 6} text={`P${i + 1}`} fontSize={12} fill={COLORS.label} fontStyle="bold" />
      </Group>
    );
  });

  // --- Render animated solution preview ---
  const isHoverPreview = previewIndex !== null && selectedSolutionIndex === null;
  const opacity = isHoverPreview ? 0.6 : 1.0;

  const renderAnimatedPreview = () => {
    if (previewIndex === null || !results) return null;

    const mechDict = results.mechanism_dicts[previewIndex];
    if (!mechDict) return null;

    // Build a joint ID → position map from animation frames
    const jointPositions = new Map<string, Position>();

    if (previewFrames && previewJointNames && previewFrames.length > 0) {
      const frameIdx = Math.min(previewFrame, previewFrames.length - 1);
      const frame = previewFrames[frameIdx];
      for (let j = 0; j < previewJointNames.length; j++) {
        const pos = frame.positions[j];
        if (pos) {
          jointPositions.set(previewJointNames[j], pos);
        }
      }
    }

    // Fallback: use static joint positions from mechanism dict
    for (const joint of mechDict.joints) {
      if (!jointPositions.has(joint.id) && joint.position[0] != null && joint.position[1] != null) {
        jointPositions.set(joint.id, { x: joint.position[0], y: joint.position[1] });
      }
    }

    const elements: JSX.Element[] = [];

    // Render links
    for (const link of mechDict.links) {
      if (link.joints.length < 2) continue;
      for (let k = 0; k < link.joints.length - 1; k++) {
        const p1 = jointPositions.get(link.joints[k]);
        const p2 = jointPositions.get(link.joints[k + 1]);
        if (!p1 || !p2) continue;

        const s1 = canvasToScreen(p1.x, p1.y);
        const s2 = canvasToScreen(p2.x, p2.y);

        let color = COLORS.link;
        let strokeWidth = 3;
        const dash: number[] | undefined = undefined;
        if (link.type === 'ground') {
          color = COLORS.groundPivot;
          strokeWidth = 4;
        } else if (link.type === 'driver' || link.type === 'arc_driver') {
          color = COLORS.crankPivot;
        }

        elements.push(
          <Line
            key={`link-${link.id}-${k}`}
            points={[s1.x, s1.y, s2.x, s2.y]}
            stroke={color}
            strokeWidth={strokeWidth}
            dash={link.type === 'ground' ? [8, 4] : dash}
            opacity={opacity}
          />
        );
      }
    }

    // Render joints
    for (const joint of mechDict.joints) {
      const pos = jointPositions.get(joint.id);
      if (!pos) continue;
      const screen = canvasToScreen(pos.x, pos.y);

      let color = COLORS.couplerPivot;
      if (mechDict.links.some((l) => l.type === 'ground' && l.joints.includes(joint.id))) {
        color = COLORS.groundPivot;
      } else if (mechDict.links.some((l) => (l.type === 'driver' || l.type === 'arc_driver') && l.joints.includes(joint.id))) {
        color = COLORS.crankPivot;
      }

      elements.push(
        <Circle key={`joint-${joint.id}`} x={screen.x} y={screen.y} radius={PIVOT_RADIUS} fill={color} opacity={opacity} />
      );
      elements.push(
        <Text key={`label-${joint.id}`} x={screen.x + 10} y={screen.y - 6} text={joint.name ?? joint.id} fontSize={11} fill={COLORS.label} fontStyle="bold" opacity={opacity} />
      );
    }

    // Render coupler point trajectory (loci) if we have animation frames
    if (previewFrames && previewJointNames && previewFrames.length > 2) {
      // Find the coupler point joint (named "P" or last tracker joint)
      const trackerJoints = mechDict.joints.filter((j) => j.type === 'tracker');
      const couplerJointId = trackerJoints.length > 0 ? trackerJoints[0].id : null;

      if (couplerJointId) {
        const lociIdx = previewJointNames.indexOf(couplerJointId);
        if (lociIdx !== -1) {
          const lociPoints: number[] = [];
          for (const frame of previewFrames) {
            const pos = frame.positions[lociIdx];
            if (pos) {
              const s = canvasToScreen(pos.x, pos.y);
              lociPoints.push(s.x, s.y);
            }
          }
          if (lociPoints.length >= 4) {
            elements.push(
              <Line key="coupler-loci" points={lociPoints} stroke={COLORS.loci} strokeWidth={1.5} dash={[4, 3]} opacity={opacity * 0.7} />
            );
          }
        }
      }
    }

    return elements;
  };

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
          {gridLines}
          {renderAnimatedPreview()}
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
