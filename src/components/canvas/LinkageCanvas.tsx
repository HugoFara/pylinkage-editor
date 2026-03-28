/**
 * Main Konva canvas for mechanism visualization and interaction.
 * Updated for link-first approach with thick solid links.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text, Group } from 'react-konva';
import type Konva from 'konva';
import { useEditorStore } from '../../stores/editorStore';
import {
  useMechanismStore,
  calculateDistance,
  generateJointId,
  generateLinkId,
} from '../../stores/mechanismStore';
import {
  LINK_COLORS,
  JOINT_COLORS,
  LINK_STYLES,
  JOINT_STYLES,
  MIN_LINK_LENGTH,
  type JointDict,
  type LinkDict,
  type Position,
} from '../../types/mechanism';

// Canvas configuration
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_SENSITIVITY = 0.001;

/** Pick a "nice" grid spacing in canvas units for the current zoom level. */
function computeGridSpacing(scale: number): number {
  // Target ~50-150 screen pixels between grid lines
  const idealCanvasSpacing = 80 / scale;
  const niceSteps = [10, 25, 50, 100, 200, 500, 1000, 2000, 5000];
  for (const step of niceSteps) {
    if (step >= idealCanvasSpacing) return step;
  }
  return niceSteps[niceSteps.length - 1];
}

export function LinkageCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const isPanning = useRef(false);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);

  // Store state
  const mode = useEditorStore((s) => s.mode);
  const selectedLinkId = useEditorStore((s) => s.selectedLinkId);
  const selectLink = useEditorStore((s) => s.selectLink);
  const selectedJointId = useEditorStore((s) => s.selectedJointId);
  const selectJoint = useEditorStore((s) => s.selectJoint);
  const hoveredLinkId = useEditorStore((s) => s.hoveredLinkId);
  const hoveredJointId = useEditorStore((s) => s.hoveredJointId);
  const setHoveredLink = useEditorStore((s) => s.setHoveredLink);
  const setHoveredJoint = useEditorStore((s) => s.setHoveredJoint);
  const showGrid = useEditorStore((s) => s.showGrid);
  const showLoci = useEditorStore((s) => s.showLoci);
  const animationFrame = useEditorStore((s) => s.animationFrame);
  const drawState = useEditorStore((s) => s.drawState);
  const setDrawState = useEditorStore((s) => s.setDrawState);
  const resetDrawState = useEditorStore((s) => s.resetDrawState);
  const scale = useEditorStore((s) => s.scale);
  const panOffset = useEditorStore((s) => s.panOffset);
  const setScale = useEditorStore((s) => s.setScale);
  const setPanOffset = useEditorStore((s) => s.setPanOffset);

  const mechanism = useMechanismStore((s) => s.mechanism);
  const addLink = useMechanismStore((s) => s.addLink);
  const loci = useMechanismStore((s) => s.loci);
  const lociJointNames = useMechanismStore((s) => s.lociJointNames);
  const deleteLink = useMechanismStore((s) => s.deleteLink);
  const updateLink = useMechanismStore((s) => s.updateLink);
  const updateJoint = useMechanismStore((s) => s.updateJoint);
  const updateJointPosition = useMechanismStore((s) => s.updateJointPosition);
  const deleteJoint = useMechanismStore((s) => s.deleteJoint);
  const findJointAtPosition = useMechanismStore((s) => s.findJointAtPosition);
  const getLinksForJoint = useMechanismStore((s) => s.getLinksForJoint);

  // Handle window resize
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

  // Get joint position at current animation frame
  const getJointPosition = useCallback(
    (joint: JointDict): Position => {
      if (loci && loci.length > 0 && animationFrame < loci.length && lociJointNames) {
        // Find the index of this joint in the simulation's joint order
        const lociIndex = lociJointNames.indexOf(joint.id);
        if (lociIndex !== -1) {
          return loci[animationFrame].positions[lociIndex];
        }
      }
      return { x: joint.position[0] ?? 0, y: joint.position[1] ?? 0 };
    },
    [loci, lociJointNames, animationFrame]
  );

  // Convert screen to canvas coordinates (accounts for zoom and pan)
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Position => ({
      x: (screenX - dimensions.width / 2 - panOffset.x) / scale,
      y: (dimensions.height / 2 + panOffset.y - screenY) / scale,
    }),
    [dimensions, scale, panOffset]
  );

  // Convert canvas to screen coordinates (accounts for zoom and pan)
  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number): Position => ({
      x: canvasX * scale + dimensions.width / 2 + panOffset.x,
      y: dimensions.height / 2 - canvasY * scale + panOffset.y,
    }),
    [dimensions, scale, panOffset]
  );

  // Handle mouse down for draw-link mode
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (mode !== 'draw-link') return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const canvasPos = screenToCanvas(pos.x, pos.y);

    // Check for snap to existing joint
    const snappedJoint = findJointAtPosition(canvasPos.x, canvasPos.y);

    setDrawState({
      isDrawing: true,
      startPoint: snappedJoint
        ? {
            x: snappedJoint.position[0] ?? canvasPos.x,
            y: snappedJoint.position[1] ?? canvasPos.y,
          }
        : canvasPos,
      endPoint: canvasPos,
      snappedToJoint: snappedJoint?.id ?? null,
      snappedEndJoint: null,
    });
  };

  // Handle mouse move
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const canvasPos = screenToCanvas(pos.x, pos.y);

    if (mode === 'draw-link' && drawState.isDrawing) {
      // Check for snap to existing joint at end point
      const snappedJoint = findJointAtPosition(canvasPos.x, canvasPos.y);

      setDrawState({
        endPoint: snappedJoint
          ? {
              x: snappedJoint.position[0] ?? canvasPos.x,
              y: snappedJoint.position[1] ?? canvasPos.y,
            }
          : canvasPos,
        snappedEndJoint: snappedJoint?.id ?? null,
      });
    }
  };

  // Handle mouse up for draw-link mode - creates link directly without modal
  const handleMouseUp = () => {
    if (mode !== 'draw-link' || !drawState.isDrawing) return;

    const { startPoint, endPoint, snappedToJoint, snappedEndJoint } = drawState;

    if (!startPoint || !endPoint) {
      resetDrawState();
      return;
    }

    // Check minimum length
    const length = calculateDistance(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
    if (length < MIN_LINK_LENGTH) {
      resetDrawState();
      return;
    }

    // Create joints and link directly without modal
    const newJoints: JointDict[] = [];
    let startJoint = snappedToJoint;
    let endJoint = snappedEndJoint;

    // If no existing joint at start, create a tracker joint (default for link extremities)
    if (!startJoint) {
      const newJoint: JointDict = {
        id: generateJointId('tracker'),
        type: 'tracker',
        position: [startPoint.x, startPoint.y],
      };
      newJoints.push(newJoint);
      startJoint = newJoint.id;
    }

    // If no existing joint at end, create a tracker joint (default for link extremities)
    if (!endJoint) {
      const newJoint: JointDict = {
        id: generateJointId('tracker'),
        type: 'tracker',
        position: [endPoint.x, endPoint.y],
      };
      newJoints.push(newJoint);
      endJoint = newJoint.id;
    }

    // Create the link
    const newLink: LinkDict = {
      id: generateLinkId('link'),
      type: 'link',
      joints: [startJoint, endJoint],
    };

    addLink(newLink, newJoints);
    resetDrawState();
  };

  // Handle stage click
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Only handle clicks on the stage itself (empty space)
    if (e.target !== e.target.getStage()) return;

    if (mode === 'select') {
      selectLink(null);
      selectJoint(null);
    }
  };

  // Handle link click
  const handleLinkClick = (link: LinkDict) => {
    if (mode === 'delete') {
      deleteLink(link.id);
      if (selectedLinkId === link.id) {
        selectLink(null);
      }
    } else {
      selectLink(link.id);
    }
  };

  // Handle joint click
  const handleJointClick = (joint: JointDict) => {
    if (mode === 'delete') {
      deleteJoint(joint.id);
      if (selectedJointId === joint.id) {
        selectJoint(null);
      }
    } else if (mode === 'place-crank' || mode === 'place-arccrank') {
      // Make connected link a driver with this joint as the motor (grounded pivot)
      // Find links connected to this joint
      const connectedLinks = getLinksForJoint(joint.id);

      if (connectedLinks.length > 0) {
        // Convert the first connected link to a driver
        const linkToConvert = connectedLinks[0];
        const driverType = mode === 'place-crank' ? 'driver' : 'arc_driver';

        updateLink(linkToConvert.id, {
          type: driverType,
          motor_joint: joint.id,
          angular_velocity: 0.1,
          initial_angle: 0,
          ...(mode === 'place-arccrank' ? { arc_start: 0, arc_end: Math.PI } : {}),
        });
      }
    } else if (mode === 'place-revolute-joint') {
      // Convert any joint to revolute
      updateJoint(joint.id, { type: 'revolute' });
    } else if (mode === 'place-prismatic-joint') {
      // Convert any joint to prismatic
      updateJoint(joint.id, { type: 'prismatic' });
    } else if (mode === 'place-tracker-joint') {
      // Convert any joint to tracker
      updateJoint(joint.id, { type: 'tracker' });
    } else {
      selectJoint(joint.id);
    }
  };

  // Handle joint drag for move-joint mode
  const handleJointDrag = (joint: JointDict, newPos: Position) => {
    updateJointPosition(joint.id, newPos.x, newPos.y);
  };

  // Handle mouse wheel for zoom
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Get canvas position under cursor before zoom
      const canvasPos = screenToCanvas(pointer.x, pointer.y);

      // Compute new scale
      const delta = -e.evt.deltaY * ZOOM_SENSITIVITY;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (1 + delta)));

      // Adjust pan so the point under cursor stays fixed
      const newPanX = pointer.x - dimensions.width / 2 - canvasPos.x * newScale;
      const newPanY = canvasPos.y * newScale - dimensions.height / 2 + pointer.y;

      setScale(newScale);
      setPanOffset({ x: newPanX, y: newPanY });
    },
    [scale, dimensions, screenToCanvas, setScale, setPanOffset]
  );

  // Handle middle-mouse panning
  const handlePanStart = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Middle mouse button (button 1) or space+left click
      if (e.evt.button === 1) {
        e.evt.preventDefault();
        isPanning.current = true;
        lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      }
    },
    []
  );

  const handlePanMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isPanning.current || !lastPanPos.current) return;

      const dx = e.evt.clientX - lastPanPos.current.x;
      const dy = e.evt.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };

      setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy });
    },
    [panOffset, setPanOffset]
  );

  const handlePanEnd = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button === 1) {
        isPanning.current = false;
        lastPanPos.current = null;
      }
    },
    []
  );

  // Render grid with graduation
  const renderGrid = () => {
    if (!showGrid) return null;

    const elements: JSX.Element[] = [];
    const { width, height } = dimensions;

    const gridSpacing = computeGridSpacing(scale);

    // Visible canvas bounds
    const topLeft = screenToCanvas(0, 0);
    const bottomRight = screenToCanvas(width, height);
    const minCX = Math.min(topLeft.x, bottomRight.x);
    const maxCX = Math.max(topLeft.x, bottomRight.x);
    const minCY = Math.min(topLeft.y, bottomRight.y);
    const maxCY = Math.max(topLeft.y, bottomRight.y);

    // Snap to grid
    const startX = Math.floor(minCX / gridSpacing) * gridSpacing;
    const endX = Math.ceil(maxCX / gridSpacing) * gridSpacing;
    const startY = Math.floor(minCY / gridSpacing) * gridSpacing;
    const endY = Math.ceil(maxCY / gridSpacing) * gridSpacing;

    // Origin in screen coords
    const origin = canvasToScreen(0, 0);

    // Vertical grid lines
    for (let cx = startX; cx <= endX; cx += gridSpacing) {
      const sx = canvasToScreen(cx, 0).x;
      elements.push(
        <Line
          key={`v-${cx}`}
          points={[sx, 0, sx, height]}
          stroke="#21262d"
          strokeWidth={1}
        />
      );
    }

    // Horizontal grid lines
    for (let cy = startY; cy <= endY; cy += gridSpacing) {
      const sy = canvasToScreen(0, cy).y;
      elements.push(
        <Line
          key={`h-${cy}`}
          points={[0, sy, width, sy]}
          stroke="#21262d"
          strokeWidth={1}
        />
      );
    }

    // Main axes (thicker)
    elements.push(
      <Line
        key="x-axis"
        points={[0, origin.y, width, origin.y]}
        stroke="#30363d"
        strokeWidth={2}
      />
    );
    elements.push(
      <Line
        key="y-axis"
        points={[origin.x, 0, origin.x, height]}
        stroke="#30363d"
        strokeWidth={2}
      />
    );

    // Tick marks and labels on X-axis
    const tickSize = 6;
    for (let cx = startX; cx <= endX; cx += gridSpacing) {
      if (cx === 0) continue; // skip origin
      const sx = canvasToScreen(cx, 0).x;
      // Tick mark
      elements.push(
        <Line
          key={`tx-${cx}`}
          points={[sx, origin.y - tickSize, sx, origin.y + tickSize]}
          stroke="#484f58"
          strokeWidth={1}
        />
      );
      // Label
      elements.push(
        <Text
          key={`lx-${cx}`}
          x={sx - 15}
          y={origin.y + tickSize + 2}
          width={30}
          align="center"
          text={String(cx)}
          fontSize={10}
          fill="#6e7681"
        />
      );
    }

    // Tick marks and labels on Y-axis
    for (let cy = startY; cy <= endY; cy += gridSpacing) {
      if (cy === 0) continue; // skip origin
      const sy = canvasToScreen(0, cy).y;
      // Tick mark
      elements.push(
        <Line
          key={`ty-${cy}`}
          points={[origin.x - tickSize, sy, origin.x + tickSize, sy]}
          stroke="#484f58"
          strokeWidth={1}
        />
      );
      // Label
      elements.push(
        <Text
          key={`ly-${cy}`}
          x={origin.x + tickSize + 4}
          y={sy - 5}
          text={String(cy)}
          fontSize={10}
          fill="#6e7681"
        />
      );
    }

    // Origin label
    elements.push(
      <Text
        key="origin-label"
        x={origin.x + tickSize + 4}
        y={origin.y + tickSize + 2}
        text="0"
        fontSize={10}
        fill="#6e7681"
      />
    );

    return <Group listening={false}>{elements}</Group>;
  };

  // Render loci (trajectory paths)
  const renderLoci = () => {
    if (!showLoci || !loci || loci.length < 2 || !mechanism || !lociJointNames) return null;

    return mechanism.joints.map((joint) => {
      // Find the index of this joint in the simulation's joint order
      const lociIndex = lociJointNames.indexOf(joint.id);
      if (lociIndex === -1) return null;

      const points: number[] = [];
      for (let frame = 0; frame < loci.length; frame++) {
        const pos = loci[frame].positions[lociIndex];
        if (!pos) continue;
        const screenPos = canvasToScreen(pos.x, pos.y);
        points.push(screenPos.x, screenPos.y);
      }

      if (points.length < 4) return null; // Need at least 2 points

      return (
        <Line
          key={`loci-${joint.id}`}
          points={points}
          stroke={JOINT_COLORS[joint.type]}
          strokeWidth={1}
          opacity={0.5}
          dash={[4, 4]}
          closed
        />
      );
    });
  };

  // Render draw preview line
  const renderDrawPreview = () => {
    if (mode !== 'draw-link' || !drawState.isDrawing) return null;

    const { startPoint, endPoint, snappedToJoint, snappedEndJoint } = drawState;
    if (!startPoint || !endPoint) return null;

    const startScreen = canvasToScreen(startPoint.x, startPoint.y);
    const endScreen = canvasToScreen(endPoint.x, endPoint.y);

    return (
      <Group>
        {/* Preview line */}
        <Line
          points={[startScreen.x, startScreen.y, endScreen.x, endScreen.y]}
          stroke="#58a6ff"
          strokeWidth={LINK_STYLES.strokeWidth.link}
          opacity={0.7}
          dash={[8, 4]}
        />
        {/* Start snap indicator */}
        {snappedToJoint && (
          <Circle
            x={startScreen.x}
            y={startScreen.y}
            radius={JOINT_STYLES.hoverRadius}
            stroke="#58a6ff"
            strokeWidth={2}
            fill="transparent"
          />
        )}
        {/* End snap indicator */}
        {snappedEndJoint && (
          <Circle
            x={endScreen.x}
            y={endScreen.y}
            radius={JOINT_STYLES.hoverRadius}
            stroke="#58a6ff"
            strokeWidth={2}
            fill="transparent"
          />
        )}
      </Group>
    );
  };

  // Render links as thick solid lines
  const renderLinks = () => {
    if (!mechanism) return null;

    return mechanism.links.map((link) => {
      // Get positions of joints in this link
      const jointPositions: Position[] = link.joints
        .map((jointId) => {
          const joint = mechanism.joints.find((j) => j.id === jointId);
          if (!joint) return null;
          return getJointPosition(joint);
        })
        .filter((p): p is Position => p !== null);

      if (jointPositions.length < 2) return null;

      const isSelected = selectedLinkId === link.id;
      const isHovered = hoveredLinkId === link.id;
      const color = LINK_COLORS[link.type];
      const baseWidth = LINK_STYLES.strokeWidth[link.type];
      const strokeWidth = isSelected
        ? LINK_STYLES.selectedStrokeWidth
        : isHovered
          ? LINK_STYLES.hoverStrokeWidth
          : baseWidth;

      // For binary links, draw a single line
      if (link.joints.length === 2) {
        const start = canvasToScreen(jointPositions[0].x, jointPositions[0].y);
        const end = canvasToScreen(jointPositions[1].x, jointPositions[1].y);

        return (
          <Line
            key={link.id}
            points={[start.x, start.y, end.x, end.y]}
            stroke={color}
            strokeWidth={strokeWidth}
            lineCap="round"
            onClick={() => handleLinkClick(link)}
            onTap={() => handleLinkClick(link)}
            onMouseEnter={() => setHoveredLink(link.id)}
            onMouseLeave={() => setHoveredLink(null)}
            style={{ cursor: mode === 'delete' ? 'not-allowed' : 'pointer' }}
          />
        );
      }

      // For ternary+ links, draw lines between all pairs
      const lines: JSX.Element[] = [];
      for (let i = 0; i < jointPositions.length; i++) {
        for (let j = i + 1; j < jointPositions.length; j++) {
          const start = canvasToScreen(jointPositions[i].x, jointPositions[i].y);
          const end = canvasToScreen(jointPositions[j].x, jointPositions[j].y);

          lines.push(
            <Line
              key={`${link.id}-${i}-${j}`}
              points={[start.x, start.y, end.x, end.y]}
              stroke={color}
              strokeWidth={strokeWidth}
              lineCap="round"
              onClick={() => handleLinkClick(link)}
              onTap={() => handleLinkClick(link)}
              onMouseEnter={() => setHoveredLink(link.id)}
              onMouseLeave={() => setHoveredLink(null)}
            />
          );
        }
      }

      return <Group key={link.id}>{lines}</Group>;
    });
  };

  // Render joints as small circles at endpoints
  const renderJoints = () => {
    if (!mechanism) return null;

    return mechanism.joints.map((joint) => {
      const pos = getJointPosition(joint);
      const screenPos = canvasToScreen(pos.x, pos.y);

      const isSelected = selectedJointId === joint.id;
      const isHovered = hoveredJointId === joint.id;
      const color = JOINT_COLORS[joint.type];
      const radius = isSelected
        ? JOINT_STYLES.selectedRadius
        : isHovered
          ? JOINT_STYLES.hoverRadius
          : JOINT_STYLES.radius;

      // Determine if joint is draggable based on mode
      const isDraggable = mode === 'move-joint';

      return (
        <Group key={joint.id}>
          {/* Joint circle */}
          <Circle
            x={screenPos.x}
            y={screenPos.y}
            radius={radius}
            fill={color}
            stroke={isSelected ? '#ffffff' : isHovered ? '#c9d1d9' : '#0d1117'}
            strokeWidth={JOINT_STYLES.strokeWidth}
            onClick={() => handleJointClick(joint)}
            onTap={() => handleJointClick(joint)}
            onMouseEnter={() => setHoveredJoint(joint.id)}
            onMouseLeave={() => setHoveredJoint(null)}
            draggable={isDraggable}
            onDragEnd={(e) => {
              const newPos = screenToCanvas(e.target.x(), e.target.y());
              handleJointDrag(joint, newPos);
            }}
            style={{ cursor: mode === 'delete' ? 'not-allowed' : 'pointer' }}
          />
          {/* Joint label */}
          <Text
            x={screenPos.x + radius + 4}
            y={screenPos.y - 6}
            text={joint.name || joint.id}
            fontSize={12}
            fill="#8b949e"
          />
        </Group>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseDown={(e) => { handlePanStart(e); handleMouseDown(e); }}
        onMouseMove={(e) => { handlePanMove(e); handleMouseMove(e); }}
        onMouseUp={(e) => { handlePanEnd(e); handleMouseUp(); }}
        onWheel={handleWheel}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        <Layer>
          {renderGrid()}
          {renderLoci()}
          {renderLinks()}
          {renderDrawPreview()}
          {renderJoints()}
        </Layer>
      </Stage>
    </div>
  );
}
