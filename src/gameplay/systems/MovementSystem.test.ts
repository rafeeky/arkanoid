import { describe, it, expect } from 'vitest';
import { moveBar, moveBall, moveItemDrop, moveAttachedBallToBar, moveBallSubSteps } from './MovementSystem';
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
// Bug A 재현 테스트: 고속 공 터널링 (sub-step 없으면 블록 통과)
// ============================================================

describe('Bug A regression: moveBallSubSteps — 고속 공 터널링 방지', () => {
  /**
   * moveBallSubSteps는 내보내기 함수로, 충돌 콜백을 받아
   * 각 서브 스텝마다 호출한다.
   * 이동 거리가 maxStepDistance(12px)를 초과하면 스텝을 분할해야 한다.
   */
  it('이동 거리가 maxStepDistance 이하면 sub-step이 1번만 호출된다', () => {
    // speed=420, dt=1/60 → distance ≈ 7px, maxStepDistance=12px → steps=1
    const ball: BallState = { ...baseBall, vx: 420, vy: 0 };
    const dt = 1 / 60;
    let callCount = 0;
    const stepped = moveBallSubSteps(ball, dt, () => {
      callCount++;
      return null; // no collision intercept
    });
    expect(callCount).toBe(1);
    expect(stepped.x).toBeCloseTo(ball.x + ball.vx * dt, 2);
  });

  it('이동 거리가 maxStepDistance 초과하면 여러 sub-step으로 분할된다', () => {
    // speed=1200, dt=0.033 → distance ≈ 40px → steps=ceil(40/12)=4
    const ball: BallState = { ...baseBall, vx: 1200, vy: 0 };
    const dt = 0.033;
    let callCount = 0;
    moveBallSubSteps(ball, dt, () => {
      callCount++;
      return null;
    });
    expect(callCount).toBeGreaterThanOrEqual(3); // 최소 3번 분할
  });

  it('sub-step 콜백에서 충돌 반환 시 해당 스텝에서 이동을 멈춘다', () => {
    // 공이 고속으로 이동하다 블록 위치(x=500)에서 충돌 감지
    const ball: BallState = { ...baseBall, x: 400, y: 300, vx: 1200, vy: 0 };
    const dt = 0.1; // 큰 dt → 120px 이동
    let stopX = -1;
    const stepped = moveBallSubSteps(ball, dt, (b) => {
      if (b.x >= 500) {
        stopX = b.x;
        return { vx: -b.vx, vy: b.vy }; // 반사
      }
      return null;
    });
    // 충돌 후 반사가 발생했으므로 최종 x는 500 근처에서 반사됨
    expect(stopX).toBeGreaterThanOrEqual(500);
    // 충돌 후 vx는 음수 (반사됨)
    expect(stepped.vx).toBeLessThan(0);
  });

  it('최대 sub-step 횟수(8)를 초과하지 않는다', () => {
    // 극단적 속도: speed=5000, dt=0.1 → 500px 이동 → steps=ceil(500/12)=42, capped at 8
    const ball: BallState = { ...baseBall, vx: 5000, vy: 0 };
    const dt = 0.1;
    let callCount = 0;
    moveBallSubSteps(ball, dt, () => {
      callCount++;
      return null;
    });
    expect(callCount).toBeLessThanOrEqual(8);
  });

  it('비활성 공은 sub-step을 실행하지 않는다', () => {
    const inactiveBall: BallState = { ...baseBall, isActive: false };
    let callCount = 0;
    const result = moveBallSubSteps(inactiveBall, 1 / 60, () => {
      callCount++;
      return null;
    });
    expect(callCount).toBe(0);
    expect(result.x).toBe(inactiveBall.x);
  });
});
