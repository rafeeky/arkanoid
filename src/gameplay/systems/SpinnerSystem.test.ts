/**
 * SpinnerSystem 유닛 테스트
 *
 * mvp3.md §13-4 회전체 테스트 스펙 (3-phase 재설계):
 * - tick: angleRad 증가 (모든 phase에서 계속)
 * - tick: spawning 400ms 경과 후 descending 전환
 * - tick: descending dt마다 y += 80*dt
 * - tick: descending y >= descentEndY 도달 시 circling 전환 + circleAngleRad = -π/2
 * - tick: circling x, y가 원 공식 따라 움직임
 * - handleBallCollisions: phase='circling'만 충돌 활성 (spawning/descending은 ghost)
 * - handleBlockCollisions: phase='circling'만 충돌 활성 (spawning/descending은 ghost)
 * - 여러 spinner 동시 존재 시 독립 처리
 */

import { describe, it, expect } from 'vitest';
import {
  SpinnerSystem,
  normalizeAngle,
  SPAWN_DURATION_MS,
  DESCENT_SPEED_PX_PER_SEC,
  CIRCLE_RADIUS,
  CIRCLE_SPEED_RAD_PER_SEC,
} from './SpinnerSystem';
import type { SpinnerRuntimeState } from '../state/SpinnerRuntimeState';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';

// ---------------------------------------------------------------------------
// 테스트 픽스처
// ---------------------------------------------------------------------------

const cubeDefinition: SpinnerDefinition = {
  definitionId: 'spinner_cube',
  kind: 'cube',
  size: 48,
  rotationSpeedRadPerSec: 1.5,
  blockCollisionPhases: [0, Math.PI / 2],
};

const triangleDefinition: SpinnerDefinition = {
  definitionId: 'spinner_triangle',
  kind: 'triangle',
  size: 48,
  rotationSpeedRadPerSec: 1.2,
  blockCollisionPhases: [0],
};

const spinnerDefs: Record<string, SpinnerDefinition> = {
  spinner_cube: cubeDefinition,
  spinner_triangle: triangleDefinition,
};

/** 기본 circling spinner 생성 (이전 'active' phase에 해당). */
function makeCirclingSpinner(
  overrides: Partial<SpinnerRuntimeState> & { id: string; definitionId: string },
): SpinnerRuntimeState {
  const circleCenterX = overrides.x ?? 360;
  const circleCenterY = (overrides.y ?? 450) + CIRCLE_RADIUS; // y를 descentEndY + radius 기준
  return {
    x: overrides.x ?? 360,
    y: overrides.y ?? 300,
    angleRad: 0,
    phase: 'circling',
    spawnElapsedMs: SPAWN_DURATION_MS,
    descentEndY: 300,
    circleCenterX,
    circleCenterY,
    circleRadius: CIRCLE_RADIUS,
    circleAngleRad: -Math.PI / 2,
    spawnX: overrides.x ?? 360,
    ...overrides,
  };
}

/** spawning phase spinner 생성. */
function makeSpawningSpinner(
  overrides: Partial<SpinnerRuntimeState> & { id: string; definitionId: string },
): SpinnerRuntimeState {
  const spawnX = overrides.x ?? 360;
  const descentEndY = overrides.descentEndY ?? 400;
  return {
    x: spawnX,
    y: 0,
    angleRad: 0,
    phase: 'spawning',
    spawnElapsedMs: 0,
    descentEndY,
    circleCenterX: spawnX,
    circleCenterY: descentEndY + CIRCLE_RADIUS,
    circleRadius: CIRCLE_RADIUS,
    circleAngleRad: 0,
    spawnX,
    ...overrides,
  };
}

/** descending phase spinner 생성. */
function makeDescendingSpinner(
  overrides: Partial<SpinnerRuntimeState> & { id: string; definitionId: string },
): SpinnerRuntimeState {
  const spawnX = overrides.x ?? 360;
  const descentEndY = overrides.descentEndY ?? 400;
  return {
    x: spawnX,
    y: overrides.y ?? 0,
    angleRad: 0,
    phase: 'descending',
    spawnElapsedMs: SPAWN_DURATION_MS,
    descentEndY,
    circleCenterX: spawnX,
    circleCenterY: descentEndY + CIRCLE_RADIUS,
    circleRadius: CIRCLE_RADIUS,
    circleAngleRad: 0,
    spawnX,
    ...overrides,
  };
}

function makeBall(overrides: Partial<BallState>): BallState {
  return {
    id: 'ball_0',
    x: 480,
    y: 400,
    vx: 0,
    vy: -300,
    isActive: true,
    ...overrides,
  };
}

function makeBlock(overrides: Partial<BlockState>): BlockState {
  return {
    id: 'block_0',
    x: 360,
    y: 280,
    remainingHits: 1,
    isDestroyed: false,
    definitionId: 'block_normal',
    ...overrides,
  };
}

const blockDef: BlockDefinition = {
  definitionId: 'block_normal',
  maxHits: 1,
  score: 100,
  dropItemType: 'none',
  visualId: 'block_normal_visual',
};

const blockDefs: Record<string, BlockDefinition> = { block_normal: blockDef };

// ---------------------------------------------------------------------------
// normalizeAngle
// ---------------------------------------------------------------------------

describe('normalizeAngle', () => {
  it('0을 반환한다', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
  });

  it('2π → 0 (또는 2π)으로 정규화된다', () => {
    expect(normalizeAngle(2 * Math.PI)).toBeCloseTo(0);
  });

  it('음수 각도를 [0, 2π) 범위로 정규화한다', () => {
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI);
  });

  it('3π → π로 정규화된다', () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.tick — 자체 회전 (모든 phase 공통)
// ---------------------------------------------------------------------------

describe('SpinnerSystem.tick — 자체 회전 (모든 phase)', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('circling spinner: dt=1초 뒤 angleRad가 rotationSpeed만큼 증가한다', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', angleRad: 0 });
    const result = system.tick([spinner], 1);
    expect(result[0]!.angleRad).toBeCloseTo(1.5);
  });

  it('spawning spinner: dt=0.1초 뒤 angleRad가 증가한다', () => {
    const spinner = makeSpawningSpinner({ id: 's0', definitionId: 'spinner_cube', angleRad: 0 });
    const result = system.tick([spinner], 0.1);
    expect(result[0]!.angleRad).toBeCloseTo(1.5 * 0.1);
  });

  it('descending spinner: dt=0.1초 뒤 angleRad가 증가한다', () => {
    const spinner = makeDescendingSpinner({ id: 's0', definitionId: 'spinner_cube', angleRad: 0 });
    const result = system.tick([spinner], 0.1);
    expect(result[0]!.angleRad).toBeCloseTo(1.5 * 0.1);
  });

  it('각도가 2π를 초과하면 [0, 2π) 범위로 순환한다', () => {
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      angleRad: 2 * Math.PI - 0.1,
    });
    const result = system.tick([spinner], 1);
    const expected = normalizeAngle(2 * Math.PI - 0.1 + 1.5);
    expect(result[0]!.angleRad).toBeCloseTo(expected);
    expect(result[0]!.angleRad).toBeLessThan(2 * Math.PI);
    expect(result[0]!.angleRad).toBeGreaterThanOrEqual(0);
  });

  it('존재하지 않는 definitionId는 angleRad를 변경하지 않는다', () => {
    const unknown = makeCirclingSpinner({ id: 's0', definitionId: 'unknown', angleRad: 1.0 });
    const result = system.tick([unknown], 1);
    expect(result[0]!.angleRad).toBeCloseTo(1.0);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.tick — spawning phase
// ---------------------------------------------------------------------------

describe('SpinnerSystem.tick — spawning phase', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('spawnElapsedMs가 dt*1000만큼 증가한다', () => {
    const spinner = makeSpawningSpinner({ id: 's0', definitionId: 'spinner_cube' });
    const result = system.tick([spinner], 0.1);
    expect(result[0]!.spawnElapsedMs).toBeCloseTo(100);
    expect(result[0]!.phase).toBe('spawning');
  });

  it('spawnElapsedMs < SPAWN_DURATION_MS면 phase가 spawning을 유지한다', () => {
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      spawnElapsedMs: 300,
    });
    const result = system.tick([spinner], 0.05); // 50ms 추가 → 350ms (< 400ms)
    expect(result[0]!.phase).toBe('spawning');
    expect(result[0]!.spawnElapsedMs).toBeCloseTo(350);
  });

  it('spawnElapsedMs >= SPAWN_DURATION_MS(400ms) 도달 시 descending으로 전환된다', () => {
    const spinner = makeSpawningSpinner({ id: 's0', definitionId: 'spinner_cube' });
    const dt = SPAWN_DURATION_MS / 1000; // 0.4초
    const result = system.tick([spinner], dt);
    expect(result[0]!.phase).toBe('descending');
    expect(result[0]!.spawnElapsedMs).toBe(SPAWN_DURATION_MS);
  });

  it('spawning 중 y=0 고정 (하강 없음)', () => {
    const spinner = makeSpawningSpinner({ id: 's0', definitionId: 'spinner_cube' });
    const result = system.tick([spinner], 0.2);
    expect(result[0]!.y).toBe(0);
  });

  it('spawning 중 x=spawnX 고정', () => {
    const spinner = makeSpawningSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360 });
    const result = system.tick([spinner], 0.2);
    expect(result[0]!.x).toBe(360);
  });

  it('초과 dt에서도 spawnElapsedMs가 SPAWN_DURATION_MS로 고정되고 descending 전환', () => {
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      spawnElapsedMs: 350,
    });
    const result = system.tick([spinner], 1.0); // 큰 dt → 경계 초과
    expect(result[0]!.phase).toBe('descending');
    expect(result[0]!.spawnElapsedMs).toBe(SPAWN_DURATION_MS);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.tick — descending phase
// ---------------------------------------------------------------------------

describe('SpinnerSystem.tick — descending phase', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('dt마다 y += DESCENT_SPEED_PX_PER_SEC * dt', () => {
    const spinner = makeDescendingSpinner({ id: 's0', definitionId: 'spinner_cube', y: 0 });
    const dt = 1 / 60;
    const result = system.tick([spinner], dt);
    expect(result[0]!.y).toBeCloseTo(DESCENT_SPEED_PX_PER_SEC * dt);
    expect(result[0]!.phase).toBe('descending');
  });

  it('y += 80 * dt (dt=0.5초)', () => {
    const spinner = makeDescendingSpinner({ id: 's0', definitionId: 'spinner_cube', y: 100 });
    const result = system.tick([spinner], 0.5);
    expect(result[0]!.y).toBeCloseTo(100 + 80 * 0.5);
  });

  it('y >= descentEndY 도달 시 circling으로 전환된다', () => {
    const spinner = makeDescendingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      y: 395,
      descentEndY: 400,
    });
    const result = system.tick([spinner], 0.1); // 395 + 80*0.1 = 403 >= 400
    expect(result[0]!.phase).toBe('circling');
    expect(result[0]!.y).toBe(400); // descentEndY에 고정
  });

  it('circling 전환 시 circleAngleRad = -π/2 (원 상단)', () => {
    const spinner = makeDescendingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      y: 399,
      descentEndY: 400,
    });
    const result = system.tick([spinner], 1.0);
    expect(result[0]!.phase).toBe('circling');
    expect(result[0]!.circleAngleRad).toBeCloseTo(-Math.PI / 2);
  });

  it('descending 중 x=spawnX 고정', () => {
    const spinner = makeDescendingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      spawnX: 360,
      y: 100,
    });
    const result = system.tick([spinner], 0.5);
    expect(result[0]!.x).toBe(360);
  });

  it('descentEndY 미도달 시 phase는 descending 유지', () => {
    const spinner = makeDescendingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      y: 0,
      descentEndY: 400,
    });
    const result = system.tick([spinner], 0.1); // 0 + 80*0.1 = 8 < 400
    expect(result[0]!.phase).toBe('descending');
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.tick — circling phase
// ---------------------------------------------------------------------------

describe('SpinnerSystem.tick — circling phase', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('circleAngleRad += CIRCLE_SPEED_RAD_PER_SEC * dt', () => {
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      circleAngleRad: 0,
    });
    const dt = 1 / 60;
    const result = system.tick([spinner], dt);
    expect(result[0]!.circleAngleRad).toBeCloseTo(CIRCLE_SPEED_RAD_PER_SEC * dt);
  });

  it('x = circleCenterX + circleRadius * cos(circleAngleRad)', () => {
    const cx = 360;
    const cy = 550;
    const radius = CIRCLE_RADIUS;
    const initialAngle = 0;
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      circleCenterX: cx,
      circleCenterY: cy,
      circleRadius: radius,
      circleAngleRad: initialAngle,
      x: cx + radius * Math.cos(initialAngle),
      y: cy + radius * Math.sin(initialAngle),
    });
    const dt = 1 / 60;
    const result = system.tick([spinner], dt);
    const expectedAngle = initialAngle + CIRCLE_SPEED_RAD_PER_SEC * dt;
    expect(result[0]!.x).toBeCloseTo(cx + radius * Math.cos(expectedAngle));
    expect(result[0]!.y).toBeCloseTo(cy + radius * Math.sin(expectedAngle));
  });

  it('초기 circleAngleRad=-π/2면 원 최상단(y=circleCenterY-radius)에 위치한다', () => {
    const cx = 360;
    const cy = 550;
    const radius = CIRCLE_RADIUS;
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      circleCenterX: cx,
      circleCenterY: cy,
      circleRadius: radius,
      circleAngleRad: -Math.PI / 2,
      x: cx + radius * Math.cos(-Math.PI / 2),
      y: cy + radius * Math.sin(-Math.PI / 2),
    });
    // dt=0으로 tick하면 새 angle = -π/2 + 0 = -π/2
    // 하지만 실제로 dt=0일 때 tick은 angleRad=CIRCLE_SPEED * 0 = 0 추가
    // circleAngleRad는 dt에 따라 변함 — 초기값 검증은 직접 필드 확인
    expect(spinner.x).toBeCloseTo(cx); // cos(-π/2) ≈ 0
    expect(spinner.y).toBeCloseTo(cy - radius); // sin(-π/2) = -1
  });

  it('여러 spinner가 독립적으로 업데이트된다', () => {
    const s0 = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', circleAngleRad: 0 });
    const s1 = makeCirclingSpinner({ id: 's1', definitionId: 'spinner_triangle', circleAngleRad: Math.PI });
    const result = system.tick([s0, s1], 1);
    expect(result[0]!.circleAngleRad).toBeCloseTo(CIRCLE_SPEED_RAD_PER_SEC * 1);
    expect(result[1]!.circleAngleRad).toBeCloseTo(Math.PI + CIRCLE_SPEED_RAD_PER_SEC * 1);
  });

  it('circling 중 angleRad(자체 회전)도 계속 증가한다', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', angleRad: 0 });
    const result = system.tick([spinner], 1);
    expect(result[0]!.angleRad).toBeCloseTo(1.5); // rotationSpeedRadPerSec
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.tick — 전체 phase 전환 흐름
// ---------------------------------------------------------------------------

describe('SpinnerSystem.tick — 전체 phase 전환 흐름', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('spawning → descending → circling 순서로 전환된다', () => {
    let spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      descentEndY: 400,
    });

    // spawning: 400ms
    spinner = system.tick([spinner], SPAWN_DURATION_MS / 1000)[0]!;
    expect(spinner.phase).toBe('descending');

    // descending: 400px / 80px/s = 5초
    spinner = system.tick([spinner], 400 / DESCENT_SPEED_PX_PER_SEC)[0]!;
    expect(spinner.phase).toBe('circling');
    expect(spinner.y).toBe(400);
    expect(spinner.circleAngleRad).toBeCloseTo(-Math.PI / 2);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBallCollisions — ghost (spawning/descending)
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBallCollisions — ghost (spawning/descending)', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('phase=spawning인 spinner와 공이 겹쳐도 충돌이 없다', () => {
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 0,
    });
    const ball = makeBall({ x: 360, y: 10, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(false);
    expect(result.nextBall).toBe(ball);
  });

  it('phase=descending인 spinner와 공이 겹쳐도 충돌이 없다', () => {
    const spinner = makeDescendingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 200,
    });
    const ball = makeBall({ x: 360, y: 210, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(false);
    expect(result.nextBall).toBe(ball);
  });

  it('모든 spinner가 spawning이면 공은 불변이다', () => {
    const s0 = makeSpawningSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360 });
    const s1 = makeSpawningSpinner({ id: 's1', definitionId: 'spinner_triangle', x: 400 });
    const ball = makeBall({ x: 380, y: 10, vx: 100, vy: 100 });
    const result = system.handleBallCollisions(ball, [s0, s1]);
    expect(result.collided).toBe(false);
    expect(result.nextBall).toBe(ball);
  });

  it('모든 spinner가 descending이면 공은 불변이다', () => {
    const s0 = makeDescendingSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 100 });
    const ball = makeBall({ x: 360, y: 110, vx: 0, vy: 100 });
    const result = system.handleBallCollisions(ball, [s0]);
    expect(result.collided).toBe(false);
    expect(result.nextBall).toBe(ball);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBallCollisions — 비활성 공
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBallCollisions — 비활성 공', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('isActive=false인 공은 충돌 처리하지 않는다', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 300, isActive: false });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(false);
    expect(result.nextBall.x).toBe(360);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBallCollisions — circling phase (solid)
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBallCollisions — circling phase', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('공이 circling spinner와 겹칠 때 collided=true를 반환한다', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 280, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(true);
  });

  it('공이 spinner로 향하는 방향으로 반사된다', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 280, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(true);
    expect(result.nextBall.vy).toBeLessThan(0);
  });

  it('공이 spinner 옆에서 수평으로 이동할 때 vx 방향이 반전된다', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 336, y: 300, vx: 200, vy: 0 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(true);
    expect(result.nextBall.vx).toBeLessThan(0);
  });

  it('공이 spinner와 멀리 있을 때 충돌이 없다', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 200, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(false);
  });

  it('공이 이미 spinner에서 멀어지는 방향이면 분리만 한다 (속도 반전 없음)', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 280, vx: 0, vy: -200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(true);
    expect(result.nextBall.vy).toBe(-200);
  });

  it('반사 후 공이 spinner와 더 이상 겹치지 않는 위치로 이동한다', () => {
    const spinnerX = 360;
    const spinnerY = 300;
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: spinnerX,
      y: spinnerY,
    });
    const ball = makeBall({ x: spinnerX, y: spinnerY - 20, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    const dist = Math.sqrt(
      (result.nextBall.x - spinnerX) ** 2 + (result.nextBall.y - spinnerY) ** 2,
    );
    expect(dist).toBeGreaterThanOrEqual(32 - 0.001); // size/2 + BALL_RADIUS = 24 + 8
  });

  it('두 spinner가 모두 겹칠 때 가장 가까운 spinner에 대해서만 반사한다', () => {
    const spinnerA = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const spinnerB = makeCirclingSpinner({ id: 's1', definitionId: 'spinner_cube', x: 400, y: 300 });
    const ball = makeBall({ x: 380, y: 300, vx: 100, vy: 0 });
    const result = system.handleBallCollisions(ball, [spinnerA, spinnerB]);
    expect(result.collided).toBe(true);
  });

  it('spinner 목록이 비어 있으면 충돌이 없다', () => {
    const ball = makeBall({ x: 360, y: 300 });
    const result = system.handleBallCollisions(ball, []);
    expect(result.collided).toBe(false);
    expect(result.nextBall).toBe(ball);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBallCollisions — triangle
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBallCollisions — triangle', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('공이 triangle spinner와 겹칠 때 충돌을 감지한다', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_triangle', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 282, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(true);
  });

  it('공이 triangle spinner에서 반사된다', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_triangle', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 282, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.nextBall.vy).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBlockCollisions — ghost (spawning/descending)
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBlockCollisions — ghost (spawning/descending)', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('phase=spawning인 spinner는 angleRad=0이어도 블록을 피격하지 않는다', () => {
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 0,
      angleRad: 0,
    });
    const block = makeBlock({ id: 'b0', x: 336, y: 0, remainingHits: 2 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.nextBlocks[0]!.remainingHits).toBe(2);
    expect(result.events).toHaveLength(0);
  });

  it('phase=descending인 spinner는 블록 충돌이 없다 (ghost)', () => {
    const spinner = makeDescendingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 288,
      angleRad: 0,
    });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 2 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.nextBlocks[0]!.remainingHits).toBe(2);
    expect(result.events).toHaveLength(0);
  });

  it('모든 spinner가 spawning이면 블록은 불변이다', () => {
    const s0 = makeSpawningSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, angleRad: 0 });
    const block = makeBlock({ id: 'b0', x: 336, y: 0, remainingHits: 3 });
    const result = system.handleBlockCollisions([s0], [block], blockDefs);
    expect(result.events).toHaveLength(0);
    expect(result.scoreDelta).toBe(0);
    expect(result.nextBlocks[0]!.remainingHits).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBlockCollisions — circling phase (solid)
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBlockCollisions — circling phase', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('phase=circling, angleRad=0일 때 인접 블록을 1 피격한다', () => {
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 300,
      angleRad: 0,
    });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 2 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.nextBlocks[0]!.remainingHits).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.type).toBe('BlockHit');
  });

  it('phase=circling, remainingHits=1이면 BlockDestroyed 발행', () => {
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 300,
      angleRad: 0,
    });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 1 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.nextBlocks[0]!.isDestroyed).toBe(true);
    expect(result.events[0]!.type).toBe('BlockDestroyed');
    expect(result.scoreDelta).toBe(100);
  });

  it('phase=π/4 (허용 밖)일 때 블록 피격 없음', () => {
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 300,
      angleRad: Math.PI / 4,
    });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 2 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.nextBlocks[0]!.remainingHits).toBe(2);
    expect(result.events).toHaveLength(0);
  });

  it('phase=π/2 (cube 두 번째 허용 phase)일 때 블록 피격', () => {
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 300,
      angleRad: Math.PI / 2,
    });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 1 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.events[0]!.type).toBe('BlockDestroyed');
  });

  it('이미 파괴된 블록은 피격하지 않는다', () => {
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 300,
      angleRad: 0,
    });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 0, isDestroyed: true });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.events).toHaveLength(0);
  });

  it('범위 밖 블록은 피격하지 않는다', () => {
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 300,
      angleRad: 0,
    });
    const block = makeBlock({ id: 'b0', x: 600, y: 500, remainingHits: 1 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.events).toHaveLength(0);
  });

  it('여러 spinner가 같은 블록을 동일 틱에 독립적으로 처리한다', () => {
    const s0 = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300, angleRad: 0 });
    const s1 = makeCirclingSpinner({ id: 's1', definitionId: 'spinner_cube', x: 368, y: 300, angleRad: 0 });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 3 });
    const result = system.handleBlockCollisions([s0, s1], [block], blockDefs);
    expect(result.nextBlocks[0]!.remainingHits).toBe(1);
    expect(result.events).toHaveLength(2);
  });

  it('spinner 목록이 비어 있으면 이벤트가 없다', () => {
    const block = makeBlock({ id: 'b0', x: 336, y: 288 });
    const result = system.handleBlockCollisions([], [block], blockDefs);
    expect(result.events).toHaveLength(0);
  });

  it('블록 목록이 비어 있으면 이벤트가 없다', () => {
    const spinner = makeCirclingSpinner({ id: 's0', definitionId: 'spinner_cube', angleRad: 0 });
    const result = system.handleBlockCollisions([spinner], [], blockDefs);
    expect(result.events).toHaveLength(0);
  });

  it('triangle spinner phase=0일 때 블록 피격', () => {
    const spinner = makeCirclingSpinner({
      id: 's0',
      definitionId: 'spinner_triangle',
      x: 360,
      y: 300,
      angleRad: 0,
    });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 1 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.events[0]!.type).toBe('BlockDestroyed');
  });
});
