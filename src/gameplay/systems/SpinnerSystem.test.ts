/**
 * SpinnerSystem 유닛 테스트
 *
 * mvp3.md §13-4 회전체 테스트 스펙:
 * - tick: angleRad 증가, 2π 순환
 * - tick: spawning 하강 로직 (spawnProgress, y, easeOutCubic)
 * - tick: spawnProgress >= 1 시 phase='active' 전환
 * - handleBallCollisions: 공-cube 충돌 (원 근사)
 * - handleBallCollisions: 공-triangle 충돌
 * - handleBallCollisions: phase='spawning'이면 충돌 skip (ghost)
 * - handleBlockCollisions: phase=0일 때 블록 피격, phase=π/4(허용 밖)일 때 피격 없음
 * - handleBlockCollisions: phase='spawning'이면 블록 피격 skip (ghost)
 * - 여러 spinner 동시 존재 시 독립 처리
 */

import { describe, it, expect } from 'vitest';
import { SpinnerSystem, normalizeAngle, SPAWN_DURATION_MS } from './SpinnerSystem';
import { easeOutCubic } from '../../shared/easing';
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

function makeSpinner(
  overrides: Partial<SpinnerRuntimeState> & { id: string; definitionId: string },
): SpinnerRuntimeState {
  return {
    x: 360,
    y: 300,
    angleRad: 0,
    phase: 'active',
    targetY: 300,
    spawnProgress: 1,
    ...overrides,
  };
}

function makeSpawningSpinner(
  overrides: Partial<SpinnerRuntimeState> & { id: string; definitionId: string; targetY: number },
): SpinnerRuntimeState {
  return {
    x: 360,
    y: 0,
    angleRad: 0,
    phase: 'spawning',
    spawnProgress: 0,
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
// SpinnerSystem.tick — active phase (기존 동작)
// ---------------------------------------------------------------------------

describe('SpinnerSystem.tick — active phase', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('dt=1초 뒤 cube spinner의 angleRad가 rotationSpeed만큼 증가한다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', angleRad: 0 });
    const result = system.tick([spinner], 1);
    expect(result[0]!.angleRad).toBeCloseTo(1.5);
  });

  it('dt=0.5초 뒤 triangle spinner의 angleRad가 절반만큼 증가한다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_triangle', angleRad: 0 });
    const result = system.tick([spinner], 0.5);
    expect(result[0]!.angleRad).toBeCloseTo(0.6);
  });

  it('각도가 2π를 초과하면 [0, 2π) 범위로 순환한다', () => {
    const spinner = makeSpinner({
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

  it('여러 spinner가 독립적으로 업데이트된다', () => {
    const cube = makeSpinner({ id: 's0', definitionId: 'spinner_cube', angleRad: 0 });
    const tri = makeSpinner({ id: 's1', definitionId: 'spinner_triangle', angleRad: 0 });
    const result = system.tick([cube, tri], 1);
    expect(result[0]!.angleRad).toBeCloseTo(1.5); // cube
    expect(result[1]!.angleRad).toBeCloseTo(1.2); // triangle
  });

  it('존재하지 않는 definitionId를 가진 spinner는 angleRad를 변경하지 않는다', () => {
    const unknown = makeSpinner({ id: 's0', definitionId: 'unknown', angleRad: 1.0 });
    const result = system.tick([unknown], 1);
    expect(result[0]!.angleRad).toBeCloseTo(1.0);
  });

  it('active spinner 위치(x, y)는 tick 후에도 변경되지 않는다 (정적 배치)', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 200, y: 400, targetY: 400 });
    const result = system.tick([spinner], 1);
    expect(result[0]!.x).toBe(200);
    expect(result[0]!.y).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.tick — spawning phase
// ---------------------------------------------------------------------------

describe('SpinnerSystem.tick — spawning phase', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('dt=400ms → spawnProgress=0.5, y=easeOutCubic(0.5)*targetY', () => {
    const targetY = 400;
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      targetY,
      spawnProgress: 0,
      y: 0,
    });
    const dt = 400 / 1000; // 0.4초
    const result = system.tick([spinner], dt);

    const expectedProgress = 400 / SPAWN_DURATION_MS; // 0.5
    const expectedY = easeOutCubic(expectedProgress) * targetY;

    expect(result[0]!.spawnProgress).toBeCloseTo(expectedProgress);
    expect(result[0]!.y).toBeCloseTo(expectedY);
    expect(result[0]!.phase).toBe('spawning');
  });

  it('dt=800ms (SPAWN_DURATION_MS) 경과 시 phase=active로 전환', () => {
    const targetY = 400;
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      targetY,
      spawnProgress: 0,
      y: 0,
    });
    const dt = SPAWN_DURATION_MS / 1000; // 0.8초
    const result = system.tick([spinner], dt);

    expect(result[0]!.phase).toBe('active');
    expect(result[0]!.spawnProgress).toBe(1);
    expect(result[0]!.y).toBe(targetY);
  });

  it('progress > 1이 되는 dt에서도 y=targetY, progress=1로 고정된다', () => {
    const targetY = 300;
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      targetY,
      spawnProgress: 0.8, // 이미 80% 진행
      y: easeOutCubic(0.8) * targetY,
    });
    const dt = 1.0; // 1초 → progress 넘침
    const result = system.tick([spinner], dt);

    expect(result[0]!.phase).toBe('active');
    expect(result[0]!.spawnProgress).toBe(1);
    expect(result[0]!.y).toBe(targetY);
  });

  it('spawnProgress=0일 때 y=0 (입구)', () => {
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      targetY: 400,
      spawnProgress: 0,
      y: 0,
    });
    // dt=0이면 진행 없음
    const result = system.tick([spinner], 0);
    expect(result[0]!.y).toBeCloseTo(0);
    expect(result[0]!.spawnProgress).toBeCloseTo(0);
  });

  it('spawning 중인 spinner의 y는 easeOutCubic 커브를 따른다 (progress=0.5)', () => {
    const targetY = 200;
    const progress = 0.5;
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      targetY,
      spawnProgress: progress,
      y: easeOutCubic(progress) * targetY,
    });
    // progress=0.5에서 dt=0 → y 불변 확인 (easeOutCubic(0.5)*200)
    const result = system.tick([spinner], 0);
    expect(result[0]!.y).toBeCloseTo(easeOutCubic(progress) * targetY);
  });

  it('x 좌표는 spawning 중에도 변경되지 않는다', () => {
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      targetY: 400,
    });
    const result = system.tick([spinner], 0.4);
    expect(result[0]!.x).toBe(360);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBallCollisions — 비활성 공
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBallCollisions — 비활성 공', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('isActive=false인 공은 충돌 처리하지 않는다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 300, isActive: false });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(false);
    expect(result.nextBall.x).toBe(360);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBallCollisions — spawning phase (ghost)
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBallCollisions — spawning phase ghost', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('phase=spawning인 spinner와 공이 겹쳐도 충돌이 없다 (ghost)', () => {
    // spinner와 공을 완전히 겹치게 배치하되 phase='spawning'
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 300,
      targetY: 300,
      spawnProgress: 0.5,
    });
    const ball = makeBall({ x: 360, y: 280, vx: 0, vy: 200 }); // 겹치는 위치
    const result = system.handleBallCollisions(ball, [spinner]);

    expect(result.collided).toBe(false);
    expect(result.nextBall.vx).toBe(ball.vx);
    expect(result.nextBall.vy).toBe(ball.vy);
    expect(result.nextBall.x).toBe(ball.x);
    expect(result.nextBall.y).toBe(ball.y);
  });

  it('모든 spinner가 spawning이면 공은 불변이다', () => {
    const s0 = makeSpawningSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 280, targetY: 400, spawnProgress: 0.3 });
    const s1 = makeSpawningSpinner({ id: 's1', definitionId: 'spinner_triangle', x: 400, y: 280, targetY: 400, spawnProgress: 0.7 });
    const ball = makeBall({ x: 380, y: 280, vx: 100, vy: 100 });
    const result = system.handleBallCollisions(ball, [s0, s1]);
    expect(result.collided).toBe(false);
    expect(result.nextBall).toBe(ball); // 동일 참조 반환
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBallCollisions — cube (원 근사)
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBallCollisions — cube', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('공이 cube spinner와 겹칠 때 collided=true를 반환한다', () => {
    // cube size=48, 반지름=24. BALL_RADIUS=8. 결합 반지름=32.
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 280, vx: 0, vy: 200 }); // 아래로 이동 중
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(true);
  });

  it('공이 cube spinner로 향하는 방향으로 반사된다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 280, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(true);
    expect(result.nextBall.vy).toBeLessThan(0);
  });

  it('공이 spinner 옆에서 수평으로 이동할 때 vx 방향이 반전된다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 336, y: 300, vx: 200, vy: 0 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(true);
    expect(result.nextBall.vx).toBeLessThan(0);
  });

  it('공이 spinner와 멀리 있을 때 충돌이 없다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 200, vx: 0, vy: 200 }); // 거리 100px
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(false);
    expect(result.nextBall.vy).toBe(200);
  });

  it('공이 이미 spinner에서 멀어지는 방향이면 분리만 한다 (속도 반전 없음)', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 280, vx: 0, vy: -200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(true);
    expect(result.nextBall.vy).toBe(-200);
  });

  it('반사 후 공이 spinner와 더 이상 겹치지 않는 위치로 이동한다', () => {
    const spinnerX = 360;
    const spinnerY = 300;
    const spinner = makeSpinner({
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
    expect(dist).toBeGreaterThanOrEqual(32 - 0.001);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBallCollisions — triangle
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBallCollisions — triangle', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('공이 triangle spinner와 겹칠 때 충돌을 감지한다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_triangle', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 282, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.collided).toBe(true);
  });

  it('공이 triangle spinner에서 반사된다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_triangle', x: 360, y: 300 });
    const ball = makeBall({ x: 360, y: 282, vx: 0, vy: 200 });
    const result = system.handleBallCollisions(ball, [spinner]);
    expect(result.nextBall.vy).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBallCollisions — 여러 spinner
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBallCollisions — 여러 spinner', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('두 spinner가 모두 겹칠 때 가장 가까운 spinner에 대해서만 반사한다', () => {
    const spinnerA = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300 });
    const spinnerB = makeSpinner({ id: 's1', definitionId: 'spinner_cube', x: 400, y: 300 });
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
// SpinnerSystem.handleBlockCollisions — spawning phase (ghost)
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBlockCollisions — spawning phase ghost', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('phase=spawning인 spinner는 phase=0이어도 블록을 피격하지 않는다', () => {
    const spinner = makeSpawningSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 288, // 블록 근접 위치
      targetY: 300,
      spawnProgress: 0.5,
      angleRad: 0, // 본래라면 활성 phase
    });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 2 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.nextBlocks[0]!.remainingHits).toBe(2);
    expect(result.events).toHaveLength(0);
  });

  it('모든 spinner가 spawning이면 블록은 불변이다', () => {
    const s0 = makeSpawningSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 288, targetY: 300, spawnProgress: 0.1, angleRad: 0 });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 3 });
    const result = system.handleBlockCollisions([s0], [block], blockDefs);
    expect(result.events).toHaveLength(0);
    expect(result.scoreDelta).toBe(0);
    expect(result.nextBlocks[0]!.remainingHits).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// SpinnerSystem.handleBlockCollisions — active phase (기존 동작)
// ---------------------------------------------------------------------------

describe('SpinnerSystem.handleBlockCollisions', () => {
  const system = new SpinnerSystem(spinnerDefs);

  it('phase=0일 때 인접 블록을 1 피격한다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300, angleRad: 0 });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 2 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.nextBlocks[0]!.remainingHits).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.type).toBe('BlockHit');
  });

  it('phase=0일 때 인접 블록 remainingHits=1이면 BlockDestroyed 발행', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300, angleRad: 0 });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 1 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.nextBlocks[0]!.isDestroyed).toBe(true);
    expect(result.events[0]!.type).toBe('BlockDestroyed');
    expect(result.scoreDelta).toBe(100);
  });

  it('phase=π/4 (허용 밖)일 때 블록 피격 없음', () => {
    const spinner = makeSpinner({
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
    const spinner = makeSpinner({
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

  it('phase=π/2 + 0.05 (허용 범위 안)일 때 블록 피격', () => {
    const spinner = makeSpinner({
      id: 's0',
      definitionId: 'spinner_cube',
      x: 360,
      y: 300,
      angleRad: Math.PI / 2 + 0.05,
    });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 1 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.events[0]!.type).toBe('BlockDestroyed');
  });

  it('이미 파괴된 블록(isDestroyed=true)은 피격하지 않는다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300, angleRad: 0 });
    const block = makeBlock({ id: 'b0', x: 336, y: 288, remainingHits: 0, isDestroyed: true });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.events).toHaveLength(0);
  });

  it('범위 밖 블록은 피격하지 않는다', () => {
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300, angleRad: 0 });
    const block = makeBlock({ id: 'b0', x: 600, y: 500, remainingHits: 1 });
    const result = system.handleBlockCollisions([spinner], [block], blockDefs);
    expect(result.events).toHaveLength(0);
  });

  it('triangle spinner phase=0일 때 블록 피격', () => {
    const spinner = makeSpinner({
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

  it('여러 spinner가 같은 블록을 동일 틱에 독립적으로 처리한다', () => {
    const s0 = makeSpinner({ id: 's0', definitionId: 'spinner_cube', x: 360, y: 300, angleRad: 0 });
    const s1 = makeSpinner({ id: 's1', definitionId: 'spinner_cube', x: 368, y: 300, angleRad: 0 });
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
    const spinner = makeSpinner({ id: 's0', definitionId: 'spinner_cube', angleRad: 0 });
    const result = system.handleBlockCollisions([spinner], [], blockDefs);
    expect(result.events).toHaveLength(0);
  });
});
