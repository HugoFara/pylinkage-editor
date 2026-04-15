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
import { useSynthesisStore } from '../../stores/synthesisStore';
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
  const setAnimationFrame = useEditorStore((s) => s.setAnimationFrame);
  const setAnimating = useEditorStore((s) => s.setAnimating);
  const drawState = useEditorStore((s) => s.drawState);
  const setDrawState = useEditorStore((s) => s.setDrawState);
  const resetDrawState = useEditorStore((s) => s.resetDrawState);
  const driverFirstJointId = useEditorStore((s) => s.driverFirstJointId);
  const setDriverFirstJoint = useEditorStore((s) => s.setDriverFirstJoint);
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

  // Interact mode: find the simulation frame where the dragged joint
  // is closest to the cursor, then snap all joints to that frame.
  const handleInteractDrag = useCallback(
    (joint: JointDict, node: Konva.Node) => {
      if (!loci || !lociJointNames || loci.length === 0) return;

      // Stop any running animation
      setAnimating(false);

      const canvasPos = screenToCanvas(node.x(), node.y());
      const jointIdx = lociJointNames.indexOf(joint.id);
      if (jointIdx === -1) return;

      // Find the frame where this joint is closest to the cursor
      let bestFrame = 0;
      let bestDist = Infinity;
      for (let f = 0; f < loci.length; f++) {
        const pos = loci[f].positions[jointIdx];
        if (!pos) continue;
        const dx = pos.x - canvasPos.x;
        const dy = pos.y - canvasPos.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestFrame = f;
        }
      }
      setAnimationFrame(bestFrame);

      // Snap the Konva node to the resolved position (not the cursor)
      const resolved = loci[bestFrame].positions[jointIdx];
      if (resolved) {
        const screenPos = canvasToScreen(resolved.x, resolved.y);
        node.x(screenPos.x);
        node.y(screenPos.y);
      }
    },
    [loci, lociJointNames, screenToCanvas, canvasToScreen, setAnimationFrame, setAnimating]
  );

  // Handle mouse down for draw-link and add-dyad modes
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (mode !== 'draw-link' && mode !== 'add-dyad') return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const canvasPos = screenToCanvas(pos.x, pos.y);

    // Check for snap to existing joint
    const snappedJoint = findJointAtPosition(canvasPos.x, canvasPos.y);

    // add-dyad mode requires snapping to an existing joint
    if (mode === 'add-dyad' && !snappedJoint) return;

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

    if ((mode === 'draw-link' || mode === 'add-dyad') && drawState.isDrawing) {
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

  // addDyad from store
  const addDyad = useMechanismStore((s) => s.addDyad);

  // Handle mouse up for draw-link and add-dyad modes
  const handleMouseUp = () => {
    if (mode === 'add-dyad' && drawState.isDrawing) {
      const { snappedToJoint, snappedEndJoint } = drawState;

      // Both ends must snap to existing joints
      if (snappedToJoint && snappedEndJoint && snappedToJoint !== snappedEndJoint) {
        addDyad(snappedToJoint, snappedEndJoint);
      }
      resetDrawState();
      return;
    }

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
      // Two-click flow: first click = leader (motor) joint, second = target joint.
      if (!driverFirstJointId) {
        setDriverFirstJoint(joint.id);
        return;
      }
      if (driverFirstJointId === joint.id) {
        // Click same joint to cancel
        setDriverFirstJoint(null);
        return;
      }

      const driverType = mode === 'place-crank' ? 'driver' : 'arc_driver';
      const motorJointId = driverFirstJointId;
      const targetJointId = joint.id;

      // Initial angle = current leader→target direction so simulation
      // starts at the joint's existing position instead of snapping to 0.
      const motorJoint = mechanism?.joints.find((j) => j.id === motorJointId);
      const targetJoint = mechanism?.joints.find((j) => j.id === targetJointId);
      const mx = motorJoint?.position[0] ?? 0;
      const my = motorJoint?.position[1] ?? 0;
      const tx = targetJoint?.position[0] ?? 0;
      const ty = targetJoint?.position[1] ?? 0;
      const initialAngle = Math.atan2(ty - my, tx - mx);

      const driverProps = {
        type: driverType as 'driver' | 'arc_driver',
        motor_joint: motorJointId,
        angular_velocity: 0.1,
        initial_angle: initialAngle,
        ...(mode === 'place-arccrank'
          ? { arc_start: initialAngle, arc_end: initialAngle + Math.PI }
          : {}),
      };

      const existingLink = mechanism?.links.find(
        (l) => l.joints.includes(motorJointId) && l.joints.includes(targetJointId)
      );

      if (existingLink) {
        updateLink(existingLink.id, driverProps);
      } else {
        const newLink: LinkDict = {
          id: generateLinkId(driverType),
          joints: [motorJointId, targetJointId],
          ...driverProps,
        };
        addLink(newLink);
      }
      setDriverFirstJoint(null);
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
    if ((mode !== 'draw-link' && mode !== 'add-dyad') || !drawState.isDrawing) return null;

    const { startPoint, endPoint, snappedToJoint, snappedEndJoint } = drawState;
    if (!startPoint || !endPoint) return null;

    const startScreen = canvasToScreen(startPoint.x, startPoint.y);
    const endScreen = canvasToScreen(endPoint.x, endPoint.y);

    // For add-dyad mode, show two lines through a midpoint (the coupler position)
    if (mode === 'add-dyad') {
      const dx = endPoint.x - startPoint.x;
      const dy = endPoint.y - startPoint.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const offset = len > 0 ? len * 0.3 : 20;
      const mx = (startPoint.x + endPoint.x) / 2;
      const my = (startPoint.y + endPoint.y) / 2;
      const cx = len > 0 ? mx - (dy / len) * offset : mx;
      const cy = len > 0 ? my + (dx / len) * offset : my + 20;
      const cScreen = canvasToScreen(cx, cy);

      return (
        <Group>
          <Line
            points={[startScreen.x, startScreen.y, cScreen.x, cScreen.y]}
            stroke="#a371f7"
            strokeWidth={LINK_STYLES.strokeWidth.link}
            opacity={0.7}
            dash={[8, 4]}
          />
          <Line
            points={[cScreen.x, cScreen.y, endScreen.x, endScreen.y]}
            stroke="#a371f7"
            strokeWidth={LINK_STYLES.strokeWidth.link}
            opacity={0.7}
            dash={[8, 4]}
          />
          {/* Coupler joint preview */}
          <Circle
            x={cScreen.x}
            y={cScreen.y}
            radius={JOINT_STYLES.radius}
            fill="#a371f7"
            opacity={0.7}
          />
          {/* Snap indicators */}
          {snappedToJoint && (
            <Circle x={startScreen.x} y={startScreen.y} radius={JOINT_STYLES.hoverRadius} stroke="#a371f7" strokeWidth={2} fill="transparent" />
          )}
          {snappedEndJoint && (
            <Circle x={endScreen.x} y={endScreen.y} radius={JOINT_STYLES.hoverRadius} stroke="#a371f7" strokeWidth={2} fill="transparent" />
          )}
        </Group>
      );
    }

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
      const isDriverLeader = driverFirstJointId === joint.id;
      const color = JOINT_COLORS[joint.type];
      const radius = isSelected || isDriverLeader
        ? JOINT_STYLES.selectedRadius
        : isHovered
          ? JOINT_STYLES.hoverRadius
          : JOINT_STYLES.radius;

      // In interact mode, check if this is a ground joint (not draggable)
      const isGroundJoint = mechanism.links.some(
        (l) => l.type === 'ground' && l.joints.includes(joint.id)
      );
      const canInteract = mode === 'interact' && !isGroundJoint && !!loci && loci.length > 0;

      return (
        <Group key={joint.id}>
          {/* Driver leader halo */}
          {isDriverLeader && (
            <Circle
              x={screenPos.x}
              y={screenPos.y}
              radius={radius + 6}
              stroke="#f7b955"
              strokeWidth={2}
              dash={[4, 3]}
              fill="transparent"
              listening={false}
            />
          )}
          {/* Joint circle */}
          <Circle
            x={screenPos.x}
            y={screenPos.y}
            radius={radius}
            fill={color}
            stroke={
              isDriverLeader
                ? '#f7b955'
                : isSelected
                  ? '#ffffff'
                  : isHovered
                    ? '#c9d1d9'
                    : '#0d1117'
            }
            strokeWidth={JOINT_STYLES.strokeWidth}
            onClick={() => handleJointClick(joint)}
            onTap={() => handleJointClick(joint)}
            onMouseEnter={() => setHoveredJoint(joint.id)}
            onMouseLeave={() => setHoveredJoint(null)}
            draggable={mode === 'move-joint' || canInteract}
            onDragMove={(e) => {
              if (mode === 'move-joint') {
                const newPos = screenToCanvas(e.target.x(), e.target.y());
                handleJointDrag(joint, newPos);
              } else if (canInteract) {
                handleInteractDrag(joint, e.target);
              }
            }}
            onDragEnd={(e) => {
              if (mode === 'move-joint') {
                const newPos = screenToCanvas(e.target.x(), e.target.y());
                handleJointDrag(joint, newPos);
              } else if (canInteract) {
                // Final snap
                handleInteractDrag(joint, e.target);
              }
            }}
            style={{ cursor: mode === 'delete' ? 'not-allowed' : mode === 'interact' ? 'grab' : 'pointer' }}
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

  // Render synthesis target points as overlay markers
  const synthesisPrecisionPoints = useSynthesisStore((s) => s.precisionPoints);
  const synthesisPoses = useSynthesisStore((s) => s.poses);
  const synthesisMode = useSynthesisStore((s) => s.mode);

  const renderSynthesisTargets = () => {
    const points = synthesisMode === 'motion'
      ? synthesisPoses.map((p) => ({ x: p.x, y: p.y }))
      : synthesisPrecisionPoints;

    if (points.length === 0) return null;

    return points.map((p, i) => {
      const screen = canvasToScreen(p.x, p.y);
      return (
        <Group key={`synth-target-${i}`}>
          {/* Crosshair marker */}
          <Line
            points={[screen.x - 8, screen.y, screen.x + 8, screen.y]}
            stroke="#f0883e"
            strokeWidth={1.5}
            opacity={0.7}
          />
          <Line
            points={[screen.x, screen.y - 8, screen.x, screen.y + 8]}
            stroke="#f0883e"
            strokeWidth={1.5}
            opacity={0.7}
          />
          <Circle
            x={screen.x}
            y={screen.y}
            radius={5}
            stroke="#f0883e"
            strokeWidth={1.5}
            opacity={0.7}
          />
          <Text
            x={screen.x + 10}
            y={screen.y - 6}
            text={`P${i + 1}`}
            fontSize={10}
            fill="#f0883e"
            opacity={0.7}
          />
        </Group>
      );
    });
  };

  const isPlacingDriver = mode === 'place-crank' || mode === 'place-arccrank';
  const driverKindLabel = mode === 'place-arccrank' ? 'arc-crank' : 'crank';
  const bannerText = isPlacingDriver
    ? driverFirstJointId
      ? `Click the target joint to drive (${driverKindLabel}). Esc to cancel.`
      : `Click the leader joint (motor pivot) for the ${driverKindLabel}.`
    : null;

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
    >
      {bannerText && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: 'rgba(247, 185, 85, 0.15)',
            border: '1px solid #f7b955',
            color: '#f7b955',
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            pointerEvents: 'none',
            backdropFilter: 'blur(4px)',
            whiteSpace: 'nowrap',
          }}
        >
          {bannerText}
        </div>
      )}
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
          {renderSynthesisTargets()}
          {renderLoci()}
          {renderLinks()}
          {renderDrawPreview()}
          {renderJoints()}
        </Layer>
      </Stage>
    </div>
  );
}
