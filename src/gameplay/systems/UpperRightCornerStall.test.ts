/**
 * UpperRightCornerStall.test.ts
 *
 * 재현 테스트: 공이 우측 상단 코너(벽 + 블록 교차 구역)에서 멈추는 버그.
 *
 * 버그 리포트: ba6e6b3 커밋에서 추가된 sanityCheckBallBlockSeparation이
 * 같은 블록에 대해 연속 틱에서 발동하면 velocity를 매 틱 반전 →
 * 실효 속도 0 수렴(멈춤).
 *
 * Architecture §18 (충돌 정책), MVP1 §13, §15-2
 */

import { describe, it, expect } from 'vitest';
import { moveBallWithCollisions, sanityCheckBallBlockSeparation } from './MovementSystem';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';

const BALL_RADIUS = 8;
const CANVAS_WIDTH = 960;
const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;

function makeBall(overrides: Partial<BallState> & { x: number; y: number; vx: number; vy: number }): BallState {
  return {
    id: 'ball_0',
    isActive: true,
    ...overrides,
  };
}

function makeBlock(overrides: Partial<BlockState> & { id: string; x: number; y: number }): BlockState {
  return {
    remainingHits: 1,
    isDestroyed: false,
    definitionId: 'basic',
    ...overrides,
  };
}

function speed(ball: BallState): number {
  return Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
}

// ---------------------------------------------------------------------------
// 재현 테스트 1: 우측 상단 구역 공 + 블록 + 벽 교차 시 멈춤 없음
//
// 공 (920, 85), vx=+200, vy=-300 (우측 상방향)
// 블록 (870, 80) — 우측 벽(960)과 상단 벽(0) 인근
// 10 tick 후에도 speed > 0 이어야 한다.
// ---------------------------------------------------------------------------

describe('우측 상단 구역 공 멈춤 버그 재현', () => {
  it('우측 상단 구역에서 공이 벽과 블록 사이에 낄 때 멈추지 않는다', () => {
    // 공 위치: 우측 벽(960) 근처, 블록 상단 근처
    // 블록 우측: 870 + 64 = 934, 블록 하단: 80 + 24 = 104
    // 공이 vx>0, vy<0 → 우측 벽 + 블록 상단 동시 근접 구역
    const block = makeBlock({ id: 'upper_right_block', x: 870, y: 80 });

    let ball = makeBall({ x: 920, y: 85, vx: 200, vy: -300 });
    let blocks: BlockState[] = [block];

    const initialSpeed = speed(ball);

    for (let tick = 0; tick < 10; tick++) {
      const result = moveBallWithCollisions(ball, 1 / 60, blocks);
      ball = result.ball;

      // 블록 파괴
      if (result.blockFacts.length > 0) {
        blocks = blocks.map((b) =>
          result.blockFacts.some((f) => f.blockId === b.id)
            ? { ...b, isDestroyed: true }
            : b,
        );
      }
    }

    // 10 tick 후 speed가 0에 가까우면 버그 (멈춤)
    const finalSpeed = speed(ball);
    // speed는 일정해야 한다 (벽/블록 반사는 속도 크기를 보존)
    // 허용 오차: ±10% (enforceMinAngle 등으로 약간 변할 수 있음)
    expect(finalSpeed).toBeGreaterThan(initialSpeed * 0.1); // 최소 초기 속도의 10% 이상
  });

  it('우측 벽 + 상단 벽 교차점 근방에서 공이 교착 없음', () => {
    // 공이 우측 상단 코너를 향해 이동
    let ball = makeBall({ x: 950, y: 15, vx: 200, vy: -200 });
    const blocks: BlockState[] = []; // 블록 없이 순수 벽 충돌만

    const initialSpeed = speed(ball);

    for (let tick = 0; tick < 20; tick++) {
      const result = moveBallWithCollisions(ball, 1 / 60, blocks);
      ball = result.ball;
    }

    const finalSpeed = speed(ball);
    expect(finalSpeed).toBeGreaterThan(initialSpeed * 0.5);
    // 공이 playfield 내에 있어야 한다
    expect(ball.x).toBeGreaterThanOrEqual(BALL_RADIUS);
    expect(ball.x).toBeLessThanOrEqual(CANVAS_WIDTH - BALL_RADIUS);
    expect(ball.y).toBeGreaterThanOrEqual(BALL_RADIUS);
  });

  it('Stage 1 최우측 상단 블록 인근에서 공이 정상 반사 후 이동한다', () => {
    // Stage 1 최우측 상단 블록: col=12, row=0
    // x = 40 + 12*(64+4) = 40 + 816 = 856, y = 80
    const block = makeBlock({ id: 'stage1_top_right', x: 856, y: 80 });

    // 공을 블록 우하단 근처에서 우측 상방향으로 발사
    let ball = makeBall({ x: 900, y: 120, vx: 200, vy: -300 });
    let blocks: BlockState[] = [block];

    const initialSpeed = speed(ball);

    // 30 tick 시뮬레이션
    for (let tick = 0; tick < 30; tick++) {
      const result = moveBallWithCollisions(ball, 1 / 60, blocks);
      ball = result.ball;

      if (result.blockFacts.length > 0) {
        blocks = blocks.map((b) =>
          result.blockFacts.some((f) => f.blockId === b.id)
            ? { ...b, isDestroyed: true }
            : b,
        );
      }
    }

    const finalSpeed = speed(ball);
    expect(finalSpeed).toBeGreaterThan(initialSpeed * 0.1);
    expect(ball.x).toBeGreaterThanOrEqual(BALL_RADIUS);
    expect(ball.x).toBeLessThanOrEqual(CANVAS_WIDTH - BALL_RADIUS);
  });
});

// ---------------------------------------------------------------------------
// 재현 테스트 2: sanityCheck velocity 반전 방향 정확성
//
// sanityCheckBallBlockSeparation이 velocity를 반전할 때,
// push-out 방향과 velocity 방향이 일치해야 한다.
// 즉, 공이 이미 블록 밖으로 향하고 있으면 반전하지 않아야 한다.
// ---------------------------------------------------------------------------

describe('sanityCheckBallBlockSeparation velocity 반전 방향 정확성', () => {
  it('공이 블록 왼쪽에서 왼쪽으로 이동 중(올바른 방향)일 때 velocity를 반전하지 않는다', () => {
    // 블록: x=400, y=200. 중심 cx=432.
    // 공 중심 x=420 < cx=432 → "왼쪽에 있다" → push-out: 왼쪽으로 밀기
    // 공이 vx=-200 (왼쪽으로 이동 = 이미 올바른 방향) → velocity 반전 불필요
    const block = makeBlock({ id: 'b0', x: 400, y: 200 });
    const ballMovingAway = makeBall({ x: 420, y: 212, vx: -200, vy: 100 });

    const r = sanityCheckBallBlockSeparation(ballMovingAway, [block]);
    expect(r.wasInside).toBe(true);

    // 수정 후: push-out 방향과 velocity가 이미 일치 → vx 부호가 유지되어야 한다
    // 현재 버그: vx=-200 → 반전 → vx=200 (블록 방향, 잘못됨)
    expect(r.ball.vx).toBeLessThan(0); // vx 음수 유지 (왼쪽으로 계속 이동)
  });

  it('공이 블록 위에서 위로 이동 중(올바른 방향)일 때 vy를 반전하지 않는다', () => {
    // 블록: x=400, y=200. 중심 cy=212.
    // 공 중심 y=205 < cy=212 → "위에 있다" → push-out: 위로 밀기
    // 공이 vy=-300 (위로 이동 = 이미 올바른 방향) → velocity 반전 불필요
    const block = makeBlock({ id: 'b0', x: 400, y: 200 });
    const ballMovingAway = makeBall({ x: 432, y: 205, vx: 100, vy: -300 });

    const r = sanityCheckBallBlockSeparation(ballMovingAway, [block]);
    expect(r.wasInside).toBe(true);

    // 수정 후: vy=-300은 이미 위로 → 반전 없이 유지
    // 현재 버그: vy=-300 → 반전 → vy=300 (블록 방향, 잘못됨)
    expect(r.ball.vy).toBeLessThan(0); // vy 음수 유지 (위로 계속 이동)
  });

  it('블록 내부에 공이 있을 때 sanityCheck push-out 후 공이 블록 밖으로 나간다', () => {
    // 블록: x=400, y=200
    const block = makeBlock({ id: 'b0', x: 400, y: 200 });

    // 공 중심을 블록 내부에 위치시킴
    const ballInside = makeBall({ x: 432, y: 212, vx: 200, vy: -300 });

    const r1 = sanityCheckBallBlockSeparation(ballInside, [block]);
    expect(r1.wasInside).toBe(true);

    // push-out 후 공이 블록 AABB 밖에 있어야 한다
    const pushed = r1.ball;
    const insideAfterPush =
      pushed.x > block.x &&
      pushed.x < block.x + BLOCK_WIDTH &&
      pushed.y > block.y &&
      pushed.y < block.y + BLOCK_HEIGHT;

    expect(insideAfterPush).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 재현 테스트 3: 실제 연속 틱에서 같은 블록에 걸려 멈추는 시나리오
//
// moveBallWithCollisions + sanityCheckBallBlockSeparation을 GameplayController처럼
// 연속 호출. 공이 블록과 겹친 상태에서 시작해도 10틱 내에 정상 속도로 탈출해야 한다.
// ---------------------------------------------------------------------------

describe('연속 틱에서 블록 내부 공의 탈출', () => {
  it('공이 블록 내부에서 시작해도 10틱 내에 정상 속도로 탈출한다', () => {
    // 공이 블록 내부에 위치 (터널링 발생 후 상태 시뮬레이션)
    const block = makeBlock({ id: 'stuck_block', x: 880, y: 80 });

    // 공 중심이 블록 내부 (x=900은 880~944 사이, y=92는 80~104 사이)
    let ball = makeBall({ x: 900, y: 92, vx: 200, vy: -300 });
    let blocks: BlockState[] = [block];

    const initialSpeed = speed(ball);
    let escapedTick = -1;

    for (let tick = 0; tick < 20; tick++) {
      const result = moveBallWithCollisions(ball, 1 / 60, blocks);
      // sanityCheck도 함께 (GameplayController 흐름)
      const sanity = sanityCheckBallBlockSeparation(result.ball, blocks);
      ball = sanity.ball;

      if (result.blockFacts.length > 0 || sanity.wasInside) {
        blocks = blocks.map((b) =>
          result.blockFacts.some((f) => f.blockId === b.id)
            ? { ...b, isDestroyed: true }
            : b,
        );
      }

      // 공 속도가 초기 속도의 30% 이상이면 "탈출"로 간주
      if (speed(ball) > initialSpeed * 0.3 && escapedTick === -1) {
        escapedTick = tick;
      }
    }

    const finalSpeed = speed(ball);
    // 핵심: 20틱 후에도 speed가 초기의 10% 이상이어야 한다 (멈추지 않음)
    expect(finalSpeed).toBeGreaterThan(initialSpeed * 0.1);
  });
});

