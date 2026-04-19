/**
 * CornerAndWallBugs.test.ts
 *
 * 5차 수정: 구체 재현 조건 재현 테스트
 *   1. 공이 블록 모서리에 맞았을 때 통과 (코너 충돌)
 *   2. 공이 벽에 튕긴 직후 블록에 가서 통과 (벽 직후 시나리오)
 *
 * Architecture §18 (충돌 정책), MVP1 §13, §15-2
 */

import { describe, it, expect } from 'vitest';
import { moveBallWithCollisions } from './MovementSystem';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';

// Constants (must match CollisionService internals)
const BALL_RADIUS = 8;
const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const CANVAS_WIDTH = 960;

// --- Helpers ---

function makeBall(overrides: Partial<BallState> = {}): BallState {
  return {
    id: 'ball_0',
    x: 480,
    y: 400,
    vx: 100,
    vy: -100,
    isActive: true,
    ...overrides,
  };
}

function makeBlock(overrides: Partial<BlockState> = {}): BlockState {
  return {
    id: 'block_0',
    x: 200,
    y: 200,
    remainingHits: 1,
    isDestroyed: false,
    definitionId: 'basic',
    ...overrides,
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

// ---------------------------------------------------------------------------
// 테스트 1: 블록 코너 대각선 진입 후 통과 안 함
//
// 공이 블록의 top-right 코너로 정확히 45° 접근.
// 반사 후 공 중심이 블록 AABB 바깥에 있어야 한다.
// ---------------------------------------------------------------------------

describe('블록 코너 대각선 진입 후 통과 안 함', () => {
  it('top-right 코너로 45° 진입 시 공이 블록 AABB 내부에 남지 않는다', () => {
    // Block: x=400, y=200. top-right 코너 = (464, 200).
    // 확장된 경계: right=472, top=192
    // 공이 45° 각도(vx>0, vy<0)로 코너에 접근
    const block = makeBlock({ id: 'corner_block', x: 400, y: 200 });

    // 공을 코너 정면 아래쪽에 위치시켜 정확한 45° 접근 유도
    // top-right 코너 좌표 (464, 200), 확장 경계: x=472, y=192
    // 공 시작: x=448, y=216 (대각선으로 코너에 접근)
    const ball = makeBall({
      x: 448,
      y: 216,
      vx: 300,
      vy: -300,
    });

    const dt = 1 / 60;
    const result = moveBallWithCollisions(ball, dt, [block]);

    // 반사 후 공 중심이 블록 AABB 내부에 있으면 버그
    expect(isBallCenterInsideBlock(result.ball, block)).toBe(false);
    // 반사가 발생했어야 한다 (blockFacts에 이 블록이 있어야 함 — 충돌 발생 확인)
    // 만약 충돌이 발생하지 않는다면 접근 경로가 블록을 빗나간 것이므로 skip
    if (result.blockFacts.length > 0) {
      expect(result.blockFacts[0]?.blockId).toBe('corner_block');
    }
  });

  it('여러 tick에 걸쳐 코너 충돌 후 공이 블록 AABB에 진입하지 않는다', () => {
    // 코너에 정확히 닿도록 공 위치 설정 (txEntry === tyEntry 조건 근접)
    // Block: x=300, y=150. top-right expanded: (372, 142)
    const block = makeBlock({ id: 'corner_block_2', x: 300, y: 150 });

    // 공이 블록의 top-right 코너를 향해 45° 진입
    const speed = 420;
    const ball = makeBall({
      x: 340,
      y: 190,
      vx: speed,
      vy: -speed,
    });

    const dt = 1 / 60;
    let currentBall = ball;
    let blocks: BlockState[] = [block];

    // 5 tick 시뮬레이션
    for (let tick = 0; tick < 5; tick++) {
      const result = moveBallWithCollisions(currentBall, dt, blocks);
      currentBall = result.ball;

      // 블록이 파괴됐으면 그 이후 틱에서는 제외
      if (result.blockFacts.length > 0) {
        blocks = blocks.map((b) =>
          result.blockFacts.some((f) => f.blockId === b.id)
            ? { ...b, isDestroyed: true }
            : b,
        );
      }

      for (const b of blocks) {
        if (!b.isDestroyed) {
          expect(isBallCenterInsideBlock(currentBall, b)).toBe(false);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 테스트 2: 벽 근처 블록 연쇄 충돌에서 공이 playfield 밖으로 나가지 않음
//
// 공 (950, 200), vx=300, vy=-100 (우측 상방향)
// 우측 벽 (960) 근처 블록 배치
// moveBallWithCollisions 후에도 ball.x ∈ [0, 960] 유지
// ---------------------------------------------------------------------------

describe('벽 근처 블록 연쇄 충돌에서 공이 playfield 밖으로 나가지 않음', () => {
  it('공이 우측 벽과 블록 사이에 있을 때 이동 후 x가 [0, 960] 범위를 벗어나지 않는다', () => {
    // 우측 벽 근처 (x=887)에 블록 배치: block.x=887, block.x+64=951 (벽 직전)
    const block = makeBlock({
      id: 'wall_block',
      x: 887,  // block.x + 64 = 951 → 우측 벽 960에 가까움
      y: 190,
    });

    // 공이 벽 쪽을 향해 이동, 블록 근처에서 시작
    const ball = makeBall({
      x: 870,
      y: 202,
      vx: 300,
      vy: -100,
    });

    const dt = 1 / 30; // 30fps — 더 큰 dt
    const result = moveBallWithCollisions(ball, dt, [block]);

    // 핵심: 공이 playfield 밖으로 나가지 않아야 한다
    expect(result.ball.x).toBeGreaterThanOrEqual(0);
    expect(result.ball.x).toBeLessThanOrEqual(CANVAS_WIDTH);
  });

  it('여러 tick에서 공이 우측 벽 근처 블록과 충돌해도 x > 960 이 되지 않는다', () => {
    // 우측 벽 바로 옆 블록
    const block = makeBlock({
      id: 'right_wall_block',
      x: 888,
      y: 180,
    });

    const ball = makeBall({
      x: 880,
      y: 192,
      vx: 400,
      vy: -200,
    });

    let currentBall = ball;
    const blocks: BlockState[] = [block];

    for (let tick = 0; tick < 10; tick++) {
      const result = moveBallWithCollisions(currentBall, 1 / 60, blocks);
      currentBall = result.ball;

      // 매 tick 후 x 범위 검증
      expect(currentBall.x).toBeGreaterThanOrEqual(0);
      expect(currentBall.x).toBeLessThanOrEqual(CANVAS_WIDTH);
    }
  });
});

// ---------------------------------------------------------------------------
// 테스트 3: 벽 반사 후 다음 틱에서 블록 통과 없음
//
// 공이 벽에 부딪힌 직후의 위치 + 속도를 시뮬레이션.
// 다음 틱에 블록이 진행 방향에 있을 때 공이 블록을 그냥 지나치지 않는다.
// ---------------------------------------------------------------------------

describe('벽 반사 후 다음 틱에서 블록 통과 없음', () => {
  it('우측 벽 반사 직후 공이 블록 방향으로 이동 시 블록 통과 없음', () => {
    // 시나리오: 공이 우측 벽을 방금 반사. 공 위치는 벽 근처.
    // vx가 음수(왼쪽 방향)로 바뀐 상태. 왼쪽에 블록이 있음.
    const block = makeBlock({
      id: 'post_wall_block',
      x: 800,
      y: 190,
    });

    // 벽 반사 직후: x는 벽 근처, vx는 음수 (왼쪽으로 이동)
    // 공이 다음 틱에 블록 방향으로 향함
    const ball = makeBall({
      x: CANVAS_WIDTH - BALL_RADIUS - 1, // 벽 직전
      y: 202,
      vx: -300,  // 왼쪽으로 이동 (벽 반사 후)
      vy: -100,
    });

    const dt = 1 / 60;
    const result = moveBallWithCollisions(ball, dt, [block]);

    // 반사가 없을 수도 있음 (블록까지 거리가 먼 경우)
    // 핵심: 공이 블록 내부에 있으면 안 됨
    expect(isBallCenterInsideBlock(result.ball, block)).toBe(false);
  });

  it('벽 반사 직후 블록과 근접 거리에서 10 tick 동안 블록 진입 없음', () => {
    // 우측 벽 반사 직후, 블록이 바로 옆에 있는 시나리오
    // 공: 우측 벽 쪽에서 vx<0 방향. 블록: 공 왼쪽 진행 방향에 위치.
    const block = makeBlock({
      id: 'near_wall_block',
      x: 860,
      y: 180,
    });

    // 벽 반사 직후 공의 상태
    const initialBall = makeBall({
      x: CANVAS_WIDTH - BALL_RADIUS - 2,
      y: 192,
      vx: -420,
      vy: -100,
    });

    let currentBall = initialBall;
    let blocks: BlockState[] = [block];

    for (let tick = 0; tick < 10; tick++) {
      const result = moveBallWithCollisions(currentBall, 1 / 60, blocks);
      currentBall = result.ball;

      if (result.blockFacts.length > 0) {
        blocks = blocks.map((b) =>
          result.blockFacts.some((f) => f.blockId === b.id)
            ? { ...b, isDestroyed: true }
            : b,
        );
      }

      for (const b of blocks) {
        if (!b.isDestroyed) {
          expect(isBallCenterInsideBlock(currentBall, b)).toBe(false);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 테스트 4: 블록 2개가 1픽셀 간격일 때 공이 모서리 충돌 시 두 블록 다 고려
//
// tight 배치에서 corner hit 처리 확인.
// 공이 두 블록이 맞닿는 모서리 근처에서 충돌 시 올바르게 반사됨.
// ---------------------------------------------------------------------------

describe('블록 2개 tight 배치에서 모서리 충돌', () => {
  it('1픽셀 간격 블록 2개 사이 모서리 충돌 시 공이 블록 내부로 진입하지 않는다', () => {
    // 두 블록: gap=1px
    // block0: x=200, y=200 (right face at 264)
    // block1: x=265, y=200 (left face at 265; gap=1px)
    const block0 = makeBlock({ id: 'block_left', x: 200, y: 200 });
    const block1 = makeBlock({ id: 'block_right', x: 265, y: 200 });
    const blocks = [block0, block1];

    // 공이 gap (x≈264.5) 바로 아래에서 위로 이동
    // gap이 1px이라 BALL_RADIUS(8px) > gap이므로 반드시 한 블록의 bottom face에 닿아야 함
    const ball = makeBall({
      x: 264.5,
      y: 260,
      vx: 10,   // 아주 약간 우측 방향
      vy: -420,
    });

    const dt = 1 / 60;
    const result = moveBallWithCollisions(ball, dt, blocks);

    for (const b of blocks) {
      expect(isBallCenterInsideBlock(result.ball, b)).toBe(false);
    }
  });

  it('gap=0 블록 2개 사이 모서리 충돌 시 공이 블록 내부로 진입하지 않는다', () => {
    // 두 블록: gap=0 (완전히 붙어있음)
    // block0: x=200, y=200 (right face at 264)
    // block1: x=264, y=200 (left face at 264)
    const block0 = makeBlock({ id: 'block_a', x: 200, y: 200 });
    const block1 = makeBlock({ id: 'block_b', x: 264, y: 200 });
    const blocks = [block0, block1];

    // 공이 두 블록의 경계(x=264) 바로 아래에서 수직으로 위로 이동
    const ball = makeBall({
      x: 264,
      y: 260,
      vx: 0,
      vy: -420,
    });

    const dt = 1 / 60;
    const result = moveBallWithCollisions(ball, dt, blocks);

    for (const b of blocks) {
      expect(isBallCenterInsideBlock(result.ball, b)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 테스트 5: moveBallWithCollisions 후 공이 항상 [0, CANVAS_WIDTH] 내에 존재
//
// 벽과 블록이 동시에 관련될 때 swept 이동 후에도 공이 playfield 안에 있어야 한다.
// ---------------------------------------------------------------------------

describe('swept 이동 후 공이 항상 playfield 내에 있음', () => {
  it('우측 벽과 블록 동시 조건에서 100 tick 동안 x 범위 이탈 없음', () => {
    // 우측 벽 쪽 블록들
    const blocks: BlockState[] = [
      makeBlock({ id: 'b0', x: 880, y: 100 }),
      makeBlock({ id: 'b1', x: 880, y: 132 }),
      makeBlock({ id: 'b2', x: 880, y: 164 }),
    ];

    // 공이 우측 방향, 블록 쪽으로 접근
    let ball = makeBall({
      x: 840,
      y: 150,
      vx: 500,
      vy: -200,
    });

    let currentBlocks = [...blocks];

    for (let tick = 0; tick < 100; tick++) {
      const result = moveBallWithCollisions(ball, 1 / 60, currentBlocks);
      ball = result.ball;

      if (result.blockFacts.length > 0) {
        currentBlocks = currentBlocks.map((b) =>
          result.blockFacts.some((f) => f.blockId === b.id)
            ? { ...b, isDestroyed: true }
            : b,
        );
      }

      // 핵심 보장: x가 playfield 밖으로 나가지 않음
      expect(ball.x).toBeGreaterThanOrEqual(0);
      expect(ball.x).toBeLessThanOrEqual(CANVAS_WIDTH);
    }
  });

  it('좌측 벽과 블록 동시 조건에서 100 tick 동안 x 범위 이탈 없음', () => {
    // 좌측 벽 쪽 블록들
    const blocks: BlockState[] = [
      makeBlock({ id: 'b0', x: 0, y: 100 }),
      makeBlock({ id: 'b1', x: 0, y: 132 }),
    ];

    // 공이 좌측 방향으로 이동
    let ball = makeBall({
      x: 120,
      y: 150,
      vx: -500,
      vy: -200,
    });

    let currentBlocks = [...blocks];

    for (let tick = 0; tick < 100; tick++) {
      const result = moveBallWithCollisions(ball, 1 / 60, currentBlocks);
      ball = result.ball;

      if (result.blockFacts.length > 0) {
        currentBlocks = currentBlocks.map((b) =>
          result.blockFacts.some((f) => f.blockId === b.id)
            ? { ...b, isDestroyed: true }
            : b,
        );
      }

      expect(ball.x).toBeGreaterThanOrEqual(0);
      expect(ball.x).toBeLessThanOrEqual(CANVAS_WIDTH);
    }
  });
});
