/**
 * CollisionSweep.test.ts
 *
 * Position-correction, re-entry prevention, and destroyed-block ghosting
 * regression tests for the swept AABB collision system.
 *
 * MVP1 §13 (충돌 정책), §15-2 (Gameplay 규칙 테스트)
 */

import { describe, it, expect } from 'vitest';
import { moveBallWithCollisions } from './MovementSystem';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';

// --- Constants that must match CollisionService internals ---
const BALL_RADIUS = 8;
// Push-out epsilon: after reflection the ball must be at least this far from
// the block face (in addition to BALL_RADIUS).
const PUSH_OUT_EPSILON = 0.1;

// --- Fixtures ---

function makeBall(overrides: Partial<BallState> = {}): BallState {
  return {
    id: 'ball_0',
    x: 480,
    y: 600,
    vx: 100,
    vy: -100,
    isActive: true,
    ...overrides,
  };
}

function makeBlock(overrides: Partial<BlockState> = {}): BlockState {
  return {
    id: 'block_0',
    x: 90,
    y: 210,
    remainingHits: 1,
    isDestroyed: false,
    definitionId: 'basic',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test 1: 반사 후 공 위치는 블록 AABB 바깥 epsilon 이상 떨어져 있어야 한다
//
// Setup:
//   block  : x=90, y=210, w=64, h=24  →  top face at y=210
//   ball   : x=100, y=200, vy=+300    →  moving downward into the block top
//   dt     : large enough to reach the block in one tick (dt=1/60 ≈ 0.0167s)
//
// After moveBallWithCollisions:
//   - vy must be negative (reflected upward)
//   - ball.y must be < (block.y - BALL_RADIUS - PUSH_OUT_EPSILON)
//     i.e. strictly outside the expanded AABB top boundary
//
// Without position correction the ball ends up exactly on the boundary
// (ball.y == block.y - BALL_RADIUS), which causes re-entry next frame.
// ---------------------------------------------------------------------------

describe('반사 후 위치 보정 (position correction)', () => {
  it('블록 상단 충돌 후 공 y는 블록 top face - BALL_RADIUS - epsilon 보다 작아야 한다', () => {
    // block top at y=210; expanded top boundary = 210 - BALL_RADIUS = 202
    const blockTopFace = 210;
    const expandedTop = blockTopFace - BALL_RADIUS;

    // Ball starts just above, moving downward fast enough to hit in one tick
    const ball = makeBall({ x: 100, y: 200, vx: 0, vy: 300 });
    const block = makeBlock({ x: 68, y: 210 }); // block x centered around ball x=100

    const dt = 1 / 60; // ~16.7 ms
    const { ball: result } = moveBallWithCollisions(ball, dt, [block]);

    // Velocity must be reflected upward
    expect(result.vy).toBeLessThan(0);

    // Position must be strictly outside — NOT on the boundary
    // Without correction: result.y === expandedTop (202) exactly
    // With correction   : result.y < expandedTop - PUSH_OUT_EPSILON
    expect(result.y).toBeLessThan(expandedTop - PUSH_OUT_EPSILON / 2);
  });

  it('블록 좌측면 충돌 후 공 x는 블록 left face - BALL_RADIUS - epsilon 보다 작아야 한다', () => {
    const blockLeftFace = 200;
    const expandedLeft = blockLeftFace - BALL_RADIUS; // 192

    // Ball starts at x=188 (4px left of expanded left=192), moving right at 300px/s.
    // dt=1/60 → dx=5, so ball enters expanded AABB during this tick.
    // block y range (expanded): 210-8=202 to 210+24+8=242; ball y=222 is inside.
    const ball = makeBall({ x: 188, y: 222, vx: 300, vy: 0 });
    const block = makeBlock({ x: 200, y: 210 });

    const dt = 1 / 60;
    const { ball: result } = moveBallWithCollisions(ball, dt, [block]);

    // Velocity must be reflected leftward
    expect(result.vx).toBeLessThan(0);

    // Position must be strictly outside the expanded left boundary
    expect(result.x).toBeLessThan(expandedLeft - PUSH_OUT_EPSILON / 2);
  });
});

// ---------------------------------------------------------------------------
// Test 2: 연속 2프레임 sweep에서 같은 블록과 재충돌하지 않는다
//
// After the first tick the ball is reflected. On the second tick (same dt),
// the same block must NOT appear in blockFacts — the ball should be moving
// away and the sweep should find no hit for that block.
// ---------------------------------------------------------------------------

describe('연속 2프레임 재충돌 방지', () => {
  it('블록 반사 후 다음 프레임에 같은 블록과 재충돌하지 않는다', () => {
    const ball = makeBall({ x: 100, y: 200, vx: 0, vy: 300 });
    const block = makeBlock({ x: 68, y: 210 });

    const dt = 1 / 60;

    // Frame 1: collision + reflection
    const frame1 = moveBallWithCollisions(ball, dt, [block]);
    expect(frame1.blockFacts.length).toBeGreaterThanOrEqual(1);
    const hitBlockId = frame1.blockFacts[0]?.blockId;
    expect(hitBlockId).toBe(block.id);

    // Frame 2: ball should be moving away — same block must NOT be hit
    const frame2 = moveBallWithCollisions(frame1.ball, dt, [block]);
    const reHit = frame2.blockFacts.some((f) => f.blockId === block.id);
    expect(reHit).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 3: 파괴된 블록은 sweep 후보에서 완전히 제외된다
//
// A block with isDestroyed=true that lies directly in the ball's path must
// produce zero blockFacts (the ball passes through it).
// ---------------------------------------------------------------------------

describe('파괴된 블록 ghosting 방지', () => {
  it('isDestroyed=true 블록은 충돌 판정에서 완전히 제외된다', () => {
    const ball = makeBall({ x: 100, y: 180, vx: 0, vy: 300 });
    const destroyedBlock = makeBlock({ x: 68, y: 210, isDestroyed: true });

    const dt = 1 / 60;
    const { blockFacts } = moveBallWithCollisions(ball, dt, [destroyedBlock]);

    expect(blockFacts.length).toBe(0);
  });

  it('파괴되지 않은 블록과 파괴된 블록이 섞여 있을 때 파괴된 블록은 무시된다', () => {
    const ball = makeBall({ x: 100, y: 180, vx: 0, vy: 300 });
    // destroyed block in direct path
    const destroyedBlock = makeBlock({ id: 'destroyed', x: 68, y: 210, isDestroyed: true });
    // active block further along the same path (y=250)
    const activeBlock = makeBlock({ id: 'active', x: 68, y: 260, isDestroyed: false });

    const dt = 1 / 15; // larger dt so ball can reach the second block
    const { blockFacts } = moveBallWithCollisions(ball, dt, [destroyedBlock, activeBlock]);

    const hitIds = blockFacts.map((f) => f.blockId);
    expect(hitIds).not.toContain('destroyed');
  });
});

// ---------------------------------------------------------------------------
// Test 4: t=0 케이스 (공이 이미 블록 내부) — push-out 수행 후 다음 틱에서 탈출
//
// If the ball starts inside the expanded AABB (happens due to FP drift or
// sub-pixel overlap), the sweep returns t=0.  The system must push the ball
// out rather than leaving it trapped.
// ---------------------------------------------------------------------------

describe('t=0 케이스: 공이 블록 내부에서 시작', () => {
  it('공이 블록 expanded AABB 안에 있을 때 반사 후 다음 틱에서 같은 블록과 재충돌하지 않는다', () => {
    // Place ball *inside* the expanded AABB (ball center at block top face)
    // block: x=200, y=300; expanded top = 300 - 8 = 292
    // ball y=294 is inside (294 > 292) but centre above block center
    const block = makeBlock({ id: 'inner_block', x: 200, y: 300 });
    const ball = makeBall({ x: 232, y: 294, vx: 0, vy: 300 }); // y=294 inside expanded top (292)

    const dt = 1 / 60;

    // Frame 1: t=0 hit — must reflect and push out
    const frame1 = moveBallWithCollisions(ball, dt, [block]);

    // Frame 2: must NOT re-hit the same block
    const frame2 = moveBallWithCollisions(frame1.ball, dt, [block]);
    const reHit = frame2.blockFacts.some((f) => f.blockId === block.id);
    expect(reHit).toBe(false);
  });
});
