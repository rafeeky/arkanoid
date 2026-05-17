import type Phaser from 'phaser';
import type { SpinnerRuntimeState } from '../../../gameplay/state/SpinnerRuntimeState';
// Note: file imports renamed SpinnerState → SpinnerRuntimeState. phase 필드 동일.
import type { SpinnerDefinition } from '../../../definitions/types/SpinnerDefinition';
import { SPAWN_DURATION_MS } from '../../../gameplay/systems/SpinnerSystem';

// pseudo-3D 면 색상.
const CUBE_FRONT = 0xaa88ff;
const CUBE_TOP   = 0xccaaff;
const CUBE_SIDE  = 0x8866dd;
const TRI_FACE0 = 0xff99cc;
const TRI_FACE1 = 0xffbbdd;
const TRI_FACE2 = 0xcc6699;

// Gate (스피너 등장 입구).
const GATE_COLOR = 0x888888;
const GATE_HEIGHT = 12;
const GATE_Y = 6;
const GATE_OPEN_END = 0.15;
const GATE_CLOSE_START = 0.85;

export type SpinnersObjects = {
  spinnerMap: Map<string, Phaser.GameObjects.Graphics>;
  gateMap: Map<string, [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle]>;
};

export function createSpinnersObjects(): SpinnersObjects {
  return {
    spinnerMap: new Map(),
    gateMap: new Map(),
  };
}

export function renderSpinners(
  scene: Phaser.Scene,
  objects: SpinnersObjects,
  spinnerStates: readonly Readonly<SpinnerRuntimeState>[],
  spinnerDefinitions: Readonly<Record<string, SpinnerDefinition>>,
): void {
  const activeSpinnerIds = new Set<string>();
  for (const spinner of spinnerStates) {
    activeSpinnerIds.add(spinner.id);
    const def = spinnerDefinitions[spinner.definitionId];
    if (def === undefined) continue;

    const spawnProgress = spinner.phase === 'spawning'
      ? Math.min(1, spinner.spawnElapsedMs / SPAWN_DURATION_MS)
      : 1.0;
    const spinnerAlpha = spinner.phase === 'spawning'
      ? 0.3 + 0.7 * spawnProgress
      : 1.0;

    let gfx = objects.spinnerMap.get(spinner.id);
    if (gfx === undefined) {
      gfx = scene.add.graphics();
      objects.spinnerMap.set(spinner.id, gfx);
    }
    gfx.clear().setAlpha(spinnerAlpha).setVisible(true);

    if (def.kind === 'cube') {
      drawCube(gfx, spinner.x, spinner.y, def.size, spinner.angleRad);
    } else {
      drawTetrahedron(gfx, spinner.x, spinner.y, def.size, spinner.angleRad);
    }

    // Gate 연출.
    renderGate(scene, objects, spinner.id, spinner.x, def.size, spinner.phase, spawnProgress);
  }

  for (const [id, obj] of objects.spinnerMap) {
    if (!activeSpinnerIds.has(id)) obj.setVisible(false);
  }
  for (const [id, gates] of objects.gateMap) {
    if (!activeSpinnerIds.has(id)) {
      gates[0].setVisible(false);
      gates[1].setVisible(false);
    }
  }
}

export function hideSpinners(objects: SpinnersObjects): void {
  for (const obj of objects.spinnerMap.values()) obj.setVisible(false);
  for (const gates of objects.gateMap.values()) {
    gates[0].setVisible(false);
    gates[1].setVisible(false);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// pseudo-3D 큐브 (Y축 회전) — 6면 painter's algorithm + 가시 판정.
// ────────────────────────────────────────────────────────────────────────────
function drawCube(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number, size: number, angleRad: number,
): void {
  const s = size / 2;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const project = (lx: number, ly: number, lz: number): [number, number, number] => {
    const rx = lx * cosA - lz * sinA;
    const rz = lx * sinA + lz * cosA;
    return [cx + rx, cy + ly, rz];
  };

  type Vtx = [number, number, number];
  const V: [Vtx, Vtx, Vtx, Vtx, Vtx, Vtx, Vtx, Vtx] = [
    project(-s, -s, -s), project( s, -s, -s),
    project( s,  s, -s), project(-s,  s, -s),
    project(-s, -s,  s), project( s, -s,  s),
    project( s,  s,  s), project(-s,  s,  s),
  ];

  type Face = { idx: [number, number, number, number]; color: number };
  const faces: Face[] = [
    { idx: [4, 5, 6, 7], color: CUBE_FRONT },
    { idx: [3, 2, 1, 0], color: CUBE_FRONT },
    { idx: [0, 1, 5, 4], color: CUBE_TOP   },
    { idx: [3, 2, 6, 7], color: CUBE_TOP   },
    { idx: [1, 2, 6, 5], color: CUBE_SIDE  },
    { idx: [4, 7, 3, 0], color: CUBE_SIDE  },
  ];

  type VisibleFace = { color: number; pts: { x: number; y: number }[]; avgZ: number };
  const visibleFaces: VisibleFace[] = [];

  for (const face of faces) {
    const [i0, i1, i2, i3] = face.idx;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const v0 = V[i0]!; const v1 = V[i1]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const v2 = V[i2]!; const v3 = V[i3]!;

    const ex1 = v1[0] - v0[0]; const ey1 = v1[1] - v0[1];
    const ex2 = v3[0] - v0[0]; const ey2 = v3[1] - v0[1];
    const nz = ex1 * ey2 - ey1 * ex2;

    if (nz >= 0) {
      const avgZ = (v0[2] + v1[2] + v2[2] + v3[2]) / 4;
      visibleFaces.push({
        color: face.color,
        pts: [
          { x: v0[0], y: v0[1] }, { x: v1[0], y: v1[1] },
          { x: v2[0], y: v2[1] }, { x: v3[0], y: v3[1] },
        ],
        avgZ,
      });
    }
  }
  visibleFaces.sort((a, b) => a.avgZ - b.avgZ);
  for (const vf of visibleFaces) {
    gfx.fillStyle(vf.color, 1).fillPoints(vf.pts, true);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// pseudo-3D 정사면체 (Y축 회전) — 4면 painter + 가시 판정.
// ────────────────────────────────────────────────────────────────────────────
function drawTetrahedron(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number, size: number, angleRad: number,
): void {
  const s = size / 2;
  const h = size * (Math.sqrt(6) / 3);
  const inv3 = 1 / Math.sqrt(3);
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const project = (lx: number, ly: number, lz: number): [number, number, number] => {
    const rx = lx * cosA - lz * sinA;
    const rz = lx * sinA + lz * cosA;
    return [cx + rx, cy + ly, rz];
  };

  type Vtx = [number, number, number];
  const T: [Vtx, Vtx, Vtx, Vtx] = [
    project(  0,    -h,        0         ),
    project(  s,  h / 3, -s * inv3       ),
    project( -s,  h / 3, -s * inv3       ),
    project(  0,  h / 3,  2 * s * inv3   ),
  ];

  type TriFace = { idx: [number, number, number]; color: number };
  const triFaces: TriFace[] = [
    { idx: [0, 1, 3], color: TRI_FACE0 },
    { idx: [0, 3, 2], color: TRI_FACE1 },
    { idx: [0, 2, 1], color: TRI_FACE2 },
    { idx: [1, 2, 3], color: TRI_FACE1 },
  ];

  type Vis = { color: number; x0: number; y0: number; x1: number; y1: number; x2: number; y2: number; avgZ: number };
  const visible: Vis[] = [];

  for (const tf of triFaces) {
    const [i0, i1, i2] = tf.idx;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const t0 = T[i0]!; const t1 = T[i1]!; const t2 = T[i2]!;

    const ex1 = t1[0] - t0[0]; const ey1 = t1[1] - t0[1];
    const ex2 = t2[0] - t0[0]; const ey2 = t2[1] - t0[1];
    const nz = ex1 * ey2 - ey1 * ex2;

    if (nz >= 0) {
      const avgZ = (t0[2] + t1[2] + t2[2]) / 3;
      visible.push({
        color: tf.color,
        x0: t0[0], y0: t0[1],
        x1: t1[0], y1: t1[1],
        x2: t2[0], y2: t2[1],
        avgZ,
      });
    }
  }
  visible.sort((a, b) => a.avgZ - b.avgZ);
  for (const vf of visible) {
    gfx.fillStyle(vf.color, 1).fillTriangle(vf.x0, vf.y0, vf.x1, vf.y1, vf.x2, vf.y2);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Gate 연출 — spawning phase 일 때 열림→유지→닫힘.
// ────────────────────────────────────────────────────────────────────────────
function renderGate(
  scene: Phaser.Scene,
  objects: SpinnersObjects,
  spinnerId: string,
  spinnerX: number,
  defSize: number,
  phase: SpinnerRuntimeState['phase'],
  spawnProgress: number,
): void {
  if (phase !== 'spawning') {
    const gates = objects.gateMap.get(spinnerId);
    if (gates !== undefined) {
      gates[0].setVisible(false);
      gates[1].setVisible(false);
    }
    return;
  }

  let openRatio: number;
  if (spawnProgress < GATE_OPEN_END) {
    openRatio = spawnProgress / GATE_OPEN_END;
  } else if (spawnProgress < GATE_CLOSE_START) {
    openRatio = 1.0;
  } else {
    openRatio = 1.0 - (spawnProgress - GATE_CLOSE_START) / (1.0 - GATE_CLOSE_START);
  }

  const halfSize = defSize / 2;
  const doorWidth = halfSize * (1.0 - openRatio);

  let gates = objects.gateMap.get(spinnerId);
  if (gates === undefined) {
    const leftDoor = scene.add.rectangle(
      spinnerX - doorWidth / 2, GATE_Y, doorWidth, GATE_HEIGHT, GATE_COLOR,
    );
    const rightDoor = scene.add.rectangle(
      spinnerX + doorWidth / 2, GATE_Y, doorWidth, GATE_HEIGHT, GATE_COLOR,
    );
    gates = [leftDoor, rightDoor];
    objects.gateMap.set(spinnerId, gates);
  }

  const [leftDoor, rightDoor] = gates;
  if (doorWidth > 0) {
    leftDoor
      .setPosition(spinnerX - doorWidth / 2, GATE_Y)
      .setSize(doorWidth, GATE_HEIGHT)
      .setFillStyle(GATE_COLOR).setAlpha(1).setVisible(true);
    rightDoor
      .setPosition(spinnerX + doorWidth / 2, GATE_Y)
      .setSize(doorWidth, GATE_HEIGHT)
      .setFillStyle(GATE_COLOR).setAlpha(1).setVisible(true);
  } else {
    leftDoor.setVisible(false);
    rightDoor.setVisible(false);
  }
}
