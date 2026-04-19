import { describe, it, expect } from 'vitest';
import { moveBar, moveBall, moveItemDrop, moveAttachedBallToBar, moveBallWithCollisions } from './MovementSystem';
import type { BarState } from '../state/BarState';
import type { BallState } from '../state/BallState';
import type { ItemDropState } from '../state/ItemDropState';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';

const baseConfig: GameplayConfig = {
  initialLives: 3,
  baseBarWidth: 120,
  barMoveSpeed: 420,
  ballInitialSpeed: 420,
  ballInitialAngleDeg: -60,
  roundIntroDurationMs: 1500,
  blockHitFlashDurationMs: 120,
  barBreakDurationMs: 700,
  expandMultiplier: 1.5,
};

const baseBar: BarState = {
  x: 480,
  y: 660,
  width: 120,
  moveSpeed: 420,
  activeEffect: 'none',
};

const baseBall: BallState = {
  id: 'ball_0',
  x: 480,
  y: 600,
  vx: 100,
  vy: -100,
  isActive: true,
};

const baseItem: ItemDropState = {
  id: 'item_0',
  itemType: 'expand',
  x: 300,
  y: 200,
  fallSpeed: 160,
  isCollected: false,
};

describe('moveBar', () => {
  it('바가 오른쪽으로 이동한다', () => {
    const result = moveBar(baseBar, 1, 1 / 60, baseConfig);
    expect(result.x).toBeGreaterThan(baseBar.x);
  });

  it('바가 왼쪽으로 이동한다', () => {
    const result = moveBar(baseBar, -1, 1 / 60, baseConfig);
    expect(result.x).toBeLessThan(baseBar.x);
  });

  it('방향 0이면 이동하지 않는다', () => {
    const result = moveBar(baseBar, 0, 1 / 60, baseConfig);
    expect(result.x).toBe(baseBar.x);
  });

  it('좌측 벽 clamp: x가 barWidth/2 미만이 되지 않는다', () => {
    const leftBar: BarState = { ...baseBar, x: 5 };
    const result = moveBar(leftBar, -1, 1 / 60, baseConfig);
    expect(result.x).toBeGreaterThanOrEqual(baseConfig.baseBarWidth / 2);
  });

  it('우측 벽 clamp: x가 960-barWidth/2 초과가 되지 않는다', () => {
    const rightBar: BarState = { ...baseBar, x: 955 };
    const result = moveBar(rightBar, 1, 1 / 60, baseConfig);
    expect(result.x).toBeLessThanOrEqual(960 - baseConfig.baseBarWidth / 2);
  });

  it('이동 속도는 dt에 비례한다', () => {
    const dt = 1 / 60;
    const result = moveBar(baseBar, 1, dt, baseConfig);
    expect(result.x).toBeCloseTo(baseBar.x + baseConfig.barMoveSpeed * dt);
  });
});

describe('moveBall', () => {
  it('활성 상태 공은 등속 이동한다', () => {
    const dt = 1 / 60;
    const result = moveBall(baseBall, dt);
    expect(result.x).toBeCloseTo(baseBall.x + baseBall.vx * dt);
    expect(result.y).toBeCloseTo(baseBall.y + baseBall.vy * dt);
  });

  it('비활성 공은 이동하지 않는다', () => {
    const inactiveBall: BallState = { ...baseBall, isActive: false };
    const result = moveBall(inactiveBall, 1 / 60);
    expect(result.x).toBe(inactiveBall.x);
    expect(result.y).toBe(inactiveBall.y);
  });

  it('속도와 방향이 보존된다', () => {
    const dt = 1 / 60;
    const result = moveBall(baseBall, dt);
    expect(result.vx).toBe(baseBall.vx);
    expect(result.vy).toBe(baseBall.vy);
  });
});

describe('moveItemDrop', () => {
  it('아이템이 아래쪽으로 낙하한다', () => {
    const dt = 1 / 60;
    const result = moveItemDrop(baseItem, dt);
    expect(result.y).toBeCloseTo(baseItem.y + baseItem.fallSpeed * dt);
  });

  it('x 좌표는 변하지 않는다', () => {
    const result = moveItemDrop(baseItem, 1 / 60);
    expect(result.x).toBe(baseItem.x);
  });
});

describe('moveAttachedBallToBar', () => {
  it('비활성 공은 바 위 중앙에 붙는다', () => {
    const inactiveBall: BallState = { ...baseBall, isActive: false };
    const result = moveAttachedBallToBar(inactiveBall, baseBar);
    expect(result.x).toBe(baseBar.x);
    expect(result.y).toBe(baseBar.y - 16);
  });

  it('활성 공은 이동하지 않는다', () => {
    const result = moveAttachedBallToBar(baseBall, baseBar);
    expect(result.x).toBe(baseBall.x);
    expect(result.y).toBe(baseBall.y);
  });
});

// ============================================================
// moveBallWithCollisions — 블록 충돌 통합 테스트
// (sub-step AABB 방식으로 재작성됨)
// ============================================================

describe('moveBallWithCollisions — 블록 충돌 기본 동작', () => {
  it('블록이 없으면 dt*v 만큼 이동한다', () => {
    const dt = 1 / 60;
    const result = moveBallWithCollisions(baseBall, dt, []);
    expect(result.ball.x).toBeCloseTo(baseBall.x + baseBall.vx * dt, 2);
    expect(result.ball.y).toBeCloseTo(baseBall.y + baseBall.vy * dt, 2);
    expect(result.blockFacts.length).toBe(0);
  });

  it('비활성 공은 그대로 반환된다', () => {
    const inactiveBall: BallState = { ...baseBall, isActive: false };
    const result = moveBallWithCollisions(inactiveBall, 1 / 60, []);
    expect(result.ball).toBe(inactiveBall);
    expect(result.blockFacts.length).toBe(0);
  });

  it('블록 상단에 충돌 시 vy가 반전된다', () => {
    const block = {
      id: 'b',
      x: 448,
      y: 300,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic',
    };
    // 공이 블록 expanded top(300-8=292) 바로 아래에서 빠르게 위로 이동
    // 1/30 dt = 0.033s, vy=-400 → 13.3px 이동 → y=373-13.3=359.7. 여전히 먼 경우
    // 블록 바로 위에서 시작해서 한 틱에 닿도록 설정
    const ball: BallState = { ...baseBall, x: 480, y: 310, vx: 0, vy: -400 };
    // dt=1/30 → dy=13.3px, y=310-13.3=296.7 → expanded top=292 통과
    const result = moveBallWithCollisions(ball, 1 / 30, [block]);
    expect(result.blockFacts.length).toBeGreaterThanOrEqual(1);
    expect(result.ball.vy).toBeGreaterThan(0); // 반사 후 아래 방향
  });

  it('파괴된 블록은 충돌 판정에서 제외된다', () => {
    const destroyedBlock = {
      id: 'b',
      x: 448,
      y: 300,
      remainingHits: 0,
      isDestroyed: true,
      definitionId: 'basic',
    };
    const ball: BallState = { ...baseBall, x: 480, y: 380, vx: 0, vy: -400 };
    const result = moveBallWithCollisions(ball, 1 / 60, [destroyedBlock]);
    expect(result.blockFacts.length).toBe(0);
  });

  it('고속 공 (1200px/s) 도 블록을 통과하지 않는다', () => {
    const block = {
      id: 'fast_block',
      x: 448,
      y: 300,
      remainingHits: 2,
      isDestroyed: false,
      definitionId: 'basic',
    };
    const ball: BallState = { ...baseBall, x: 480, y: 500, vx: 0, vy: -1200 };
    const result = moveBallWithCollisions(ball, 1 / 60, [block]);
    // 공이 블록 내부에 없어야 함
    const inside =
      result.ball.x > block.x &&
      result.ball.x < block.x + 64 &&
      result.ball.y > block.y &&
      result.ball.y < block.y + 24;
    expect(inside).toBe(false);
  });
});
