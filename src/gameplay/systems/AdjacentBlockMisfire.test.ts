/**
 * AdjacentBlockMisfire.test.ts
 *
 * 인접 블록 그리드에서 잘못된 블록이 hit으로 판정되거나
 * 공이 블록 내부로 진입하는 버그를 검증.
 *
 * Stage 1 실제 레이아웃 기준:
 *   BLOCK_WIDTH=64, BLOCK_HEIGHT=24, BLOCK_GAP=4, BALL_RADIUS=8
 *   col stride = 64 + 4 = 68px
 *
 * sub-step AABB 방식으로 재작성 (sweepBallVsBlocks 직접 테스트 제거).
 *
 * Architecture §18 (충돌 정책), MVP1 §13 (충돌 정책 범위)
 */

import { describe, it, expect } from 'vitest';
import { moveBallWithCollisions } from './MovementSystem';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';

// --- Constants matching CollisionService internals ---
const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const BALL_RADIUS = 8;

// Stage 1 layout constants
const LEFT_MARGIN = 40;
const BLOCK_GAP = 4;
const BLOCK_COL_STRIDE = BLOCK_WIDTH + BLOCK_GAP; // 68
const BLOCK_ROW_STRIDE = BLOCK_HEIGHT + BLOCK_GAP; // 28
const GRID_START_Y = 80;

function blockAt(col: number, row: number, id: string): BlockState {
  return {
    id,
    x: LEFT_MARGIN + col * BLOCK_COL_STRIDE,
    y: GRID_START_Y + row * BLOCK_ROW_STRIDE,
    remainingHits: 1,
    isDestroyed: false,
    definitionId: 'basic',
  };
}

function isBallCenterInsideBlock(ball: BallState, block: BlockState): boolean {
  if (block.isDestroyed) return false;
  return (
    ball.x > block.x &&
    ball.x < block.x + BLOCK_WIDTH &&
    ball.y > block.y &&
    ball.y < block.y + BLOCK_HEIGHT
  );
}

// 2×2 grid — same layout as Stage 1 top-left corner
//   A = (col 0, row 0): x=40,  y=80
//   B = (col 1, row 0): x=108, y=80
//   C = (col 0, row 1): x=40,  y=108
//   D = (col 1, row 1): x=108, y=108
const blockA = blockAt(0, 0, 'A');
const blockB = blockAt(1, 0, 'B');
const blockC = blockAt(0, 1, 'C');
const blockD = blockAt(1, 1, 'D');
const all2x2 = [blockA, blockB, blockC, blockD];

// ---------------------------------------------------------------------------
// 테스트 1: 수직 하강 시 올바른 블록이 hit
//
// 공이 블록 A의 top-right 모서리 방향으로 수직 하강.
// 어느 블록이 hit되든 공이 블록 내부에 남으면 안 된다.
// ---------------------------------------------------------------------------
describe('블록 A top-right 모서리 접근 시 공이 블록 내부에 진입하지 않음', () => {
  it('블록 A의 right face에서 수직 하강 후 공이 블록 내부에 없다', () => {
    // x=104: A right face 근처. 아래로 이동.
    const ball: BallState = {
      id: 'ball_0',
      x: 104,
      y: 60,
      vx: 0,
      vy: 300,
      isActive: true,
    };

    const dt = 0.1;
    const result = moveBallWithCollisions(ball, dt, all2x2);

    // 공이 어느 블록 내부에도 없어야 한다
    for (const block of all2x2) {
      expect(isBallCenterInsideBlock(result.ball, block)).toBe(false);
    }

    // 블록이 hit됐다면 A 또는 B여야 한다 (C/D는 하단 행)
    if (result.blockFacts.length > 0) {
      const hitIds = result.blockFacts.map((f) => f.blockId);
      for (const id of hitIds) {
        expect(['A', 'B']).toContain(id);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 테스트 2: diagonal overlap 구역에서 공이 블록 내부로 진입하지 않음
// ---------------------------------------------------------------------------
describe('diagonal overlap 구역에서 공이 블록 내부에 진입하지 않음', () => {
  it('x=103에서 수직 하강 후 공이 블록 내부에 없다', () => {
    const ball: BallState = { id: 'ball_0', x: 103, y: 60, vx: 0, vy: 300, isActive: true };
    const result = moveBallWithCollisions(ball, 0.1, all2x2);
    for (const block of all2x2) {
      expect(isBallCenterInsideBlock(result.ball, block)).toBe(false);
    }
  });

  it('x=109에서 수직 하강 후 공이 블록 내부에 없다', () => {
    const ball: BallState = { id: 'ball_0', x: 109, y: 60, vx: 0, vy: 300, isActive: true };
    const result = moveBallWithCollisions(ball, 0.1, all2x2);
    for (const block of all2x2) {
      expect(isBallCenterInsideBlock(result.ball, block)).toBe(false);
    }
  });

  it('x=106(중앙)에서 수직 하강 후 C/D(하단 행)는 내부 진입 없음', () => {
    const ball: BallState = { id: 'ball_0', x: 106, y: 60, vx: 0, vy: 300, isActive: true };
    const result = moveBallWithCollisions(ball, 0.1, all2x2);
    expect(isBallCenterInsideBlock(result.ball, blockC)).toBe(false);
    expect(isBallCenterInsideBlock(result.ball, blockD)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 테스트 3: 4px 간격 블록 사이에서 수직 진입
// ---------------------------------------------------------------------------
describe('4px 간격 블록 사이에서 수직 진입 시 블록 내부 진입 없음', () => {
  it('간격 정중앙(x=106)에서 하강 시 C/D는 내부 진입 없음', () => {
    const ball: BallState = { id: 'ball_0', x: 106, y: 50, vx: 0, vy: 300, isActive: true };
    const result = moveBallWithCollisions(ball, 0.1, all2x2);
    for (const block of all2x2) {
      expect(isBallCenterInsideBlock(result.ball, block)).toBe(false);
    }
    // C/D는 hit되지 않아야 함 (공이 상단 행에서 반사됨)
    const hitIds = result.blockFacts.map((f) => f.blockId);
    expect(hitIds).not.toContain('C');
    expect(hitIds).not.toContain('D');
  });
});

// ---------------------------------------------------------------------------
// 테스트 4: y축 overlap 구역에서 블록 내부 진입 없음
// ---------------------------------------------------------------------------
describe('y축 overlap 구역에서 공이 블록 내부에 진입하지 않음', () => {
  it('x=72(A/C center), y=130에서 위로 상승 후 공이 블록 내부에 없다', () => {
    const ball: BallState = { id: 'ball_0', x: 72, y: 130, vx: 0, vy: -300, isActive: true };
    const result = moveBallWithCollisions(ball, 0.1, [blockA, blockC]);
    expect(isBallCenterInsideBlock(result.ball, blockA)).toBe(false);
    expect(isBallCenterInsideBlock(result.ball, blockC)).toBe(false);
  });

  it('x=72, y=95에서 수직 하강 후 공이 블록 내부에 없다', () => {
    const ball: BallState = { id: 'ball_0', x: 72, y: 95, vx: 0, vy: 300, isActive: true };
    const result = moveBallWithCollisions(ball, 0.1, [blockA, blockC]);
    expect(isBallCenterInsideBlock(result.ball, blockA)).toBe(false);
    expect(isBallCenterInsideBlock(result.ball, blockC)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 테스트 5: 공이 블록 그리드를 통과하지 않음 (100 tick 시뮬레이션)
// ---------------------------------------------------------------------------
describe('2x2 블록 그리드 100 tick 시뮬레이션 — 블록 내부 진입 없음', () => {
  it('다양한 각도에서 100 tick 동안 블록 내부 진입 없음', () => {
    const speeds = [300, 600];
    const angles = [-45, -60, -75, -90, -120, -135];

    for (const speed of speeds) {
      for (const angleDeg of angles) {
        const rad = (angleDeg * Math.PI) / 180;
        let ball: BallState = {
          id: 'ball_0',
          x: 106,
          y: 400,
          vx: Math.cos(rad) * speed,
          vy: Math.sin(rad) * speed,
          isActive: true,
        };
        let currentBlocks = all2x2.map((b) => ({ ...b }));

        for (let tick = 0; tick < 100; tick++) {
          if (ball.y < 0 || ball.y > 720) break;

          const result = moveBallWithCollisions(ball, 1 / 60, currentBlocks);
          ball = result.ball;

          for (const f of result.blockFacts) {
            currentBlocks = currentBlocks.map((b) =>
              b.id === f.blockId ? { ...b, isDestroyed: true } : b,
            );
          }

          for (const block of currentBlocks) {
            if (isBallCenterInsideBlock(ball, block)) {
              throw new Error(
                `[angle=${angleDeg}° speed=${speed}] tick=${tick}: ball inside ${block.id}` +
                ` at (${ball.x.toFixed(2)},${ball.y.toFixed(2)})`,
              );
            }
          }
        }
      }
    }
  });
});
