/**
 * Client-side kinematic solver for planar linkages.
 *
 * Handles circle-circle (revolute) and circle-line (prismatic) intersections
 * so simple mechanisms (four-bars, slider-cranks) can animate without a backend.
 * Falls back gracefully for unsupported topologies (triads, etc.).
 */

import type {
  JointDict,
  LinkDict,
  MechanismDict,
  SimulationFrame,
  Position,
} from '../types/mechanism';

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

/**
 * Circle-circle intersection: find the point closest to `hint`.
 * Returns null if circles don't intersect.
 */
function solveCircleCircle(
  ax: number, ay: number, r1: number,
  bx: number, by: number, r2: number,
  hintX: number, hintY: number,
): { x: number; y: number } | null {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9 || d < 1e-12) {
    return null; // No intersection
  }

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = r1 * r1 - a * a;
  const h = hSq > 0 ? Math.sqrt(hSq) : 0;

  const mx = ax + a * dx / d;
  const my = ay + a * dy / d;

  const px = -dy / d * h;
  const py = dx / d * h;

  const sol1 = { x: mx + px, y: my + py };
  const sol2 = { x: mx - px, y: my - py };

  // Pick the solution closest to the hint
  const d1 = (sol1.x - hintX) ** 2 + (sol1.y - hintY) ** 2;
  const d2 = (sol2.x - hintX) ** 2 + (sol2.y - hintY) ** 2;
  return d1 <= d2 ? sol1 : sol2;
}

/**
 * Circle-line intersection: find the point closest to `hint`.
 * Line defined by two points (lx1,ly1)-(lx2,ly2).
 * Circle centered at (cx,cy) with radius r.
 * Returns null if no intersection.
 */
function solveCircleLine(
  cx: number, cy: number, r: number,
  lx1: number, ly1: number, lx2: number, ly2: number,
  hintX: number, hintY: number,
): { x: number; y: number } | null {
  const ldx = lx2 - lx1;
  const ldy = ly2 - ly1;
  const lenSq = ldx * ldx + ldy * ldy;
  if (lenSq < 1e-12) return null;

  // Quadratic: |P + t*D - C|^2 = r^2
  const fx = lx1 - cx;
  const fy = ly1 - cy;
  const a = lenSq;
  const b = 2 * (fx * ldx + fy * ldy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;

  if (disc < -1e-9) return null;

  const sqrtDisc = disc > 0 ? Math.sqrt(disc) : 0;
  const t1 = (-b + sqrtDisc) / (2 * a);
  const t2 = (-b - sqrtDisc) / (2 * a);

  const sol1 = { x: lx1 + t1 * ldx, y: ly1 + t1 * ldy };
  const sol2 = { x: lx1 + t2 * ldx, y: ly1 + t2 * ldy };

  const d1 = (sol1.x - hintX) ** 2 + (sol1.y - hintY) ** 2;
  const d2 = (sol2.x - hintX) ** 2 + (sol2.y - hintY) ** 2;
  return d1 <= d2 ? sol1 : sol2;
}

// ---------------------------------------------------------------------------
// Distance computation
// ---------------------------------------------------------------------------

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

interface JointState {
  x: number;
  y: number;
  solved: boolean;
}

/**
 * Simulate a mechanism entirely in the browser.
 *
 * Returns SimulationFrame[] and joint name order, or null if the mechanism
 * is too complex for client-side solving (triads, etc.).
 */
export function simulateLocal(
  mech: MechanismDict,
): { frames: SimulationFrame[]; jointNames: string[] } | null {
  const { joints, links } = mech;
  if (joints.length === 0 || links.length === 0) return null;

  // Build lookup maps
  const jointMap = new Map<string, JointDict>();
  for (const j of joints) jointMap.set(j.id, j);

  const jointNames = joints.map((j) => j.id);

  // Identify ground joints (on ground links)
  const groundJointIds = new Set<string>();
  for (const link of links) {
    if (link.type === 'ground') {
      for (const jid of link.joints) groundJointIds.add(jid);
    }
  }

  // Identify driver links and their output joints
  const drivers: {
    link: LinkDict;
    motorId: string;
    outputId: string;
    radius: number;
    omega: number;
    initialAngle: number;
  }[] = [];

  for (const link of links) {
    if (link.type !== 'driver' && link.type !== 'arc_driver') continue;
    const motorId = link.motor_joint ?? link.joints.find((id) => groundJointIds.has(id));
    const outputId = link.joints.find((id) => id !== motorId);
    if (!motorId || !outputId) continue;

    const motor = jointMap.get(motorId);
    const output = jointMap.get(outputId);
    if (!motor || !output) continue;

    const mx = motor.position[0] ?? 0;
    const my = motor.position[1] ?? 0;
    const ox = output.position[0] ?? 0;
    const oy = output.position[1] ?? 0;

    drivers.push({
      link,
      motorId,
      outputId,
      radius: dist(mx, my, ox, oy),
      omega: link.angular_velocity ?? 0.1,
      initialAngle: link.initial_angle ?? Math.atan2(oy - my, ox - mx),
    });
  }

  if (drivers.length === 0) return null; // No driver, can't simulate

  // Compute link distances (cached from initial positions)
  const linkDistances = new Map<string, Map<string, number>>();
  for (const link of links) {
    if (link.type === 'ground') continue;
    const dists = new Map<string, number>();
    for (let i = 0; i < link.joints.length; i++) {
      for (let j = i + 1; j < link.joints.length; j++) {
        const ja = jointMap.get(link.joints[i]);
        const jb = jointMap.get(link.joints[j]);
        if (!ja || !jb) continue;
        const ax = ja.position[0] ?? 0;
        const ay = ja.position[1] ?? 0;
        const bx = jb.position[0] ?? 0;
        const by = jb.position[1] ?? 0;
        const d = dist(ax, ay, bx, by);
        dists.set(`${link.joints[i]}:${link.joints[j]}`, d);
        dists.set(`${link.joints[j]}:${link.joints[i]}`, d);
      }
    }
    linkDistances.set(link.id, dists);
  }

  // Helper: get distance between two joints via a connecting link
  function getLinkDistance(jA: string, jB: string): number | null {
    for (const link of links) {
      if (link.type === 'ground') continue;
      if (link.joints.includes(jA) && link.joints.includes(jB)) {
        const dists = linkDistances.get(link.id);
        if (dists) return dists.get(`${jA}:${jB}`) ?? null;
      }
    }
    return null;
  }

  // Compute solve order: iteratively find joints that can be solved
  const driverOutputIds = new Set(drivers.map((d) => d.outputId));
  const solveOrder: string[] = [];

  // Trackers without ref joints have no motion constraint -> treat as static
  // anchors fixed at their initial position. Includes default driver-leader
  // joints and dyad endpoints created without an explicit ground link.
  const staticAnchorIds = new Set<string>();
  for (const j of joints) {
    if (j.type === 'tracker' && (!j.ref_joint1_id || !j.ref_joint2_id)) {
      staticAnchorIds.add(j.id);
    }
  }

  const solved = new Set<string>([
    ...groundJointIds,
    ...driverOutputIds,
    ...staticAnchorIds,
  ]);

  const remaining = joints
    .filter((j) => !solved.has(j.id))
    .filter((j) => j.type !== 'tracker')
    .map((j) => j.id);

  const tryResolve = () => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const jid = remaining[i];
        const j = jointMap.get(jid)!;

        // Find solved anchors connected via links
        const anchors: { id: string; dist: number }[] = [];
        for (const link of links) {
          if (!link.joints.includes(jid)) continue;
          for (const otherId of link.joints) {
            if (otherId === jid || !solved.has(otherId)) continue;
            const d = getLinkDistance(jid, otherId);
            if (d !== null) anchors.push({ id: otherId, dist: d });
          }
        }

        const canSolve =
          (j.type === 'revolute' && anchors.length >= 2) ||
          (j.type === 'prismatic' && anchors.length >= 1);

        if (canSolve) {
          solveOrder.push(jid);
          solved.add(jid);
          remaining.splice(i, 1);
          changed = true;
        }
      }
    }
  };

  tryResolve();

  // Fallback: any remaining joint is under-constrained (e.g., a dyad endpoint
  // with no other links). Pin it at its initial position so it can act as an
  // anchor for adjacent joints, then re-run the resolver to unlock the rest.
  while (remaining.length > 0) {
    const jid = remaining.shift()!;
    solved.add(jid);
    staticAnchorIds.add(jid);
    tryResolve();
  }

  // Determine iteration count from the slowest driver
  const minOmega = Math.min(...drivers.map((d) => Math.abs(d.omega)));
  if (minOmega === 0) return null;
  const iterations = Math.round((2 * Math.PI) / minOmega);

  // Initialize joint state from initial positions
  const state: Map<string, JointState> = new Map();
  for (const j of joints) {
    state.set(j.id, {
      x: j.position[0] ?? 0,
      y: j.position[1] ?? 0,
      solved: false,
    });
  }

  // Run simulation
  const frames: SimulationFrame[] = [];

  for (let step = 0; step < iterations; step++) {
    // Mark all as unsolved
    for (const s of state.values()) s.solved = false;

    // Ground joints are always solved
    for (const gid of groundJointIds) {
      const s = state.get(gid)!;
      s.solved = true;
    }

    // Static anchors (free trackers + under-constrained fallbacks) stay put
    for (const sid of staticAnchorIds) {
      const s = state.get(sid)!;
      s.solved = true;
    }

    // Step drivers
    for (const drv of drivers) {
      const motor = state.get(drv.motorId)!;
      const angle = drv.initialAngle + drv.omega * step;
      const output = state.get(drv.outputId)!;
      output.x = motor.x + drv.radius * Math.cos(angle);
      output.y = motor.y + drv.radius * Math.sin(angle);
      output.solved = true;
    }

    // Solve joints in order
    let failed = false;
    for (const jid of solveOrder) {
      const j = jointMap.get(jid)!;
      const js = state.get(jid)!;

      // Collect solved anchors
      const anchors: { x: number; y: number; dist: number }[] = [];
      for (const link of links) {
        if (!link.joints.includes(jid)) continue;
        for (const otherId of link.joints) {
          if (otherId === jid) continue;
          const os = state.get(otherId);
          if (!os || !os.solved) continue;
          const d = getLinkDistance(jid, otherId);
          if (d !== null) anchors.push({ x: os.x, y: os.y, dist: d });
        }
      }

      if (j.type === 'revolute' && anchors.length >= 2) {
        const result = solveCircleCircle(
          anchors[0].x, anchors[0].y, anchors[0].dist,
          anchors[1].x, anchors[1].y, anchors[1].dist,
          js.x, js.y,
        );
        if (!result) { failed = true; break; }
        js.x = result.x;
        js.y = result.y;
        js.solved = true;
      } else if (j.type === 'prismatic' && anchors.length >= 1) {
        const axis = j.axis ?? [1, 0];
        const lp = j.position; // line passes through initial position
        const lpx = lp[0] ?? 0;
        const lpy = lp[1] ?? 0;
        const result = solveCircleLine(
          anchors[0].x, anchors[0].y, anchors[0].dist,
          lpx, lpy, lpx + axis[0] * 100, lpy + axis[1] * 100,
          js.x, js.y,
        );
        if (!result) { failed = true; break; }
        js.x = result.x;
        js.y = result.y;
        js.solved = true;
      } else {
        failed = true;
        break;
      }
    }

    if (failed) {
      // If any frame fails, abort and return null to fall back to backend
      return null;
    }

    // Update tracker joints
    for (const j of joints) {
      if (j.type !== 'tracker') continue;
      if (!j.ref_joint1_id || !j.ref_joint2_id) continue;
      const ref1 = state.get(j.ref_joint1_id);
      const ref2 = state.get(j.ref_joint2_id);
      if (!ref1 || !ref2) continue;
      const baseAngle = Math.atan2(ref2.y - ref1.y, ref2.x - ref1.x);
      const totalAngle = baseAngle + (j.angle ?? 0);
      const d = j.distance ?? 0;
      const ts = state.get(j.id)!;
      ts.x = ref1.x + d * Math.cos(totalAngle);
      ts.y = ref1.y + d * Math.sin(totalAngle);
      ts.solved = true;
    }

    // Record frame
    const positions: Position[] = joints.map((j) => {
      const s = state.get(j.id)!;
      return { x: s.x, y: s.y };
    });
    frames.push({ step, positions });
  }

  return { frames, jointNames };
}
