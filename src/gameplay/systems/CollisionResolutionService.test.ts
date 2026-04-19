import { describe, it, expect } from 'vitest';
import { applyCollisions } from './CollisionResolutionService';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { BallState } from '../state/BallState';
import type { BarState } from '../state/BarState';
import type { BlockState } from '../state/BlockState';
import type { ItemDropState } from '../state/ItemDropState';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { ItemDefinition } from '../../definitions/types/ItemDefinition';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { CollisionFact } from './CollisionService';

// --- Fixtures ---

const config: GameplayConfig = {
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

const blockDefinitions: Record<string, BlockDefinition> = {
  basic: { definitionId: 'basic', maxHits: 1, score: 10, dropItemType: 'none', visualId: 'v' },
  basic_drop: { definitionId: 'basic_drop', maxHits: 1, score: 10, dropItemType: 'expand', visualId: 'v' },
  tough: { definitionId: 'tough', maxHits: 2, score: 30, dropItemType: 'none', visualId: 'v' },
};

const itemDefinitions: Record<string, ItemDefinition> = {
  expand: {
    itemType: 'expand',
    displayNameTextId: 'txt_item_expand_name',
    descriptionTextId: 'txt_item_expand_desc',
    iconId: 'icon_item_expand',
    fallSpeed: 160,
    effectType: 'expand',
    expandMultiplier: 1.5,
  },
};

const tables = { blockDefinitions, itemDefinitions, config };

function makeState(overrides: Partial<GameplayRuntimeState> = {}): GameplayRuntimeState {
  return {
    session: { currentStageIndex: 0, score: 0, lives: 3, highScore: 0 },
    bar: { x: 480, y: 660, width: 120, moveSpeed: 420, activeEffect: 'none' },
    balls: [],
    blocks: [],
    itemDrops: [],
    isStageCleared: false,
    magnetRemainingTime: 0,
    attachedBallIds: [],
    laserCooldownRemaining: 0,
    laserShots: [],
    spinnerStates: [],
    ...overrides,
  };
}

function activeBall(overrides: Partial<BallState> = {}): BallState {
  return { id: 'ball_0', x: 480, y: 600, vx: 100, vy: 100, isActive: true, ...overrides };
}

function firstBall(state: GameplayRuntimeState) {
  const b = state.balls[0];
  if (!b) throw new Error('No ball in state');
  return b;
}

// --- Wall reflection tests ---

describe('BallHitWall resolution', () => {
  it('좌측 벽 충돌 → vx 반전', () => {
    const ball = activeBall({ vx: -200, vy: 100 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitWall', ballId: 'ball_0', side: 'left' }];
    const { nextState } = applyCollisions(state, facts, tables);
    expect(firstBall(nextState).vx).toBeGreaterThan(0);
    expect(firstBall(nextState).vy).toBe(ball.vy);
  });

  it('우측 벽 충돌 → vx 반전', () => {
    const ball = activeBall({ vx: 200, vy: 100 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitWall', ballId: 'ball_0', side: 'right' }];
    const { nextState } = applyCollisions(state, facts, tables);
    expect(firstBall(nextState).vx).toBeLessThan(0);
    expect(firstBall(nextState).vy).toBe(ball.vy);
  });

  it('상단 벽 충돌 → vy 반전', () => {
    const ball = activeBall({ vx: 100, vy: -200 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitWall', ballId: 'ball_0', side: 'top' }];
    const { nextState } = applyCollisions(state, facts, tables);
    expect(firstBall(nextState).vy).toBeGreaterThan(0);
    expect(firstBall(nextState).vx).toBe(ball.vx);
  });
});

// --- Bar reflection tests ---

describe('BallHitBar resolution', () => {
  it('바 중앙 충돌 → vy 음수(위쪽), enforceMinAngle에 의해 |vx| >= speed * sin(15°)', () => {
    const speed = 420;
    const ball = activeBall({ vx: 0, vy: speed });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: 0 }];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    const minVx = speed * Math.sin((15 * Math.PI) / 180); // ≈ 108.7
    expect(result.vy).toBeLessThan(0);
    // enforceMinAngle guarantees vx is at least sin(15°)*speed — no longer near 0
    expect(Math.abs(result.vx)).toBeGreaterThanOrEqual(minVx - 0.01);
  });

  it('바 좌단 충돌 → vy 음수, vx 음수(왼쪽)', () => {
    const ball = activeBall({ vx: 0, vy: 420 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: -1 }];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    expect(result.vy).toBeLessThan(0);
    expect(result.vx).toBeLessThan(0);
  });

  it('바 우단 충돌 → vy 음수, vx 양수(오른쪽)', () => {
    const ball = activeBall({ vx: 0, vy: 420 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: 1 }];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    expect(result.vy).toBeLessThan(0);
    expect(result.vx).toBeGreaterThan(0);
  });

  it('바 충돌 후 속도 크기가 유지된다 (오차 허용)', () => {
    const speed = 420;
    const ball = activeBall({ vx: 200, vy: speed });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: 0.3 }];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    const newSpeed = Math.sqrt(result.vx * result.vx + result.vy * result.vy);
    const origSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    expect(newSpeed).toBeCloseTo(origSpeed, 0);
  });
});

// --- Block collision tests ---

describe('BallHitBlock resolution', () => {
  it('블록 상단 충돌 → vy 반전 + BlockHit 이벤트 (maxHits=2)', () => {
    const block: BlockState = {
      id: 'block_0',
      x: 200,
      y: 100,
      remainingHits: 2,
      isDestroyed: false,
      definitionId: 'tough',
    };
    const ball = activeBall({ vy: 100 });
    const state = makeState({ balls: [ball], blocks: [block] });
    const facts: CollisionFact[] = [
      { type: 'BallHitBlock', ballId: 'ball_0', blockId: 'block_0', side: 'top' },
    ];
    const { nextState, events } = applyCollisions(state, facts, tables);
    expect(firstBall(nextState).vy).toBeLessThan(0);
    expect(events).toContainEqual({ type: 'BlockHit', blockId: 'block_0', remainingHits: 1 });
    const b0 = nextState.blocks[0];
    if (!b0) throw new Error('No block');
    expect(b0.isDestroyed).toBe(false);
    expect(b0.remainingHits).toBe(1);
  });

  it('블록 파괴 → BlockDestroyed 이벤트 + 점수 증가', () => {
    const block: BlockState = {
      id: 'block_0',
      x: 200,
      y: 100,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic',
    };
    const ball = activeBall({ vy: 100 });
    const state = makeState({ balls: [ball], blocks: [block] });
    const facts: CollisionFact[] = [
      { type: 'BallHitBlock', ballId: 'ball_0', blockId: 'block_0', side: 'top' },
    ];
    const { nextState, events } = applyCollisions(state, facts, tables);
    const b0 = nextState.blocks[0];
    if (!b0) throw new Error('No block');
    expect(b0.isDestroyed).toBe(true);
    expect(events.some((e) => e.type === 'BlockDestroyed')).toBe(true);
    expect(nextState.session.score).toBe(10);
  });

  it('드랍 블록 파괴 → ItemSpawned 이벤트', () => {
    const block: BlockState = {
      id: 'block_0',
      x: 200,
      y: 100,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic_drop',
    };
    const ball = activeBall({ vy: 100 });
    const state = makeState({ balls: [ball], blocks: [block], itemDrops: [] });
    const facts: CollisionFact[] = [
      { type: 'BallHitBlock', ballId: 'ball_0', blockId: 'block_0', side: 'top' },
    ];
    const { events } = applyCollisions(state, facts, tables);
    expect(events.some((e) => e.type === 'ItemSpawned')).toBe(true);
  });

  it('아이템이 이미 있으면 드랍 블록 파괴 시 ItemSpawned 발생하지 않는다', () => {
    const block: BlockState = {
      id: 'block_0',
      x: 200,
      y: 100,
      remainingHits: 1,
      isDestroyed: false,
      definitionId: 'basic_drop',
    };
    const existingItem: ItemDropState = {
      id: 'item_existing',
      itemType: 'expand',
      x: 300,
      y: 300,
      fallSpeed: 160,
      isCollected: false,
    };
    const ball = activeBall({ vy: 100 });
    const state = makeState({ balls: [ball], blocks: [block], itemDrops: [existingItem] });
    const facts: CollisionFact[] = [
      { type: 'BallHitBlock', ballId: 'ball_0', blockId: 'block_0', side: 'top' },
    ];
    const { events } = applyCollisions(state, facts, tables);
    expect(events.some((e) => e.type === 'ItemSpawned')).toBe(false);
  });
});

// --- Floor tests ---

describe('BallHitFloor resolution', () => {
  it('바닥 충돌 → 공 비활성화 + LifeLost 이벤트', () => {
    const ball = activeBall();
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitFloor', ballId: 'ball_0' }];
    const { nextState, events } = applyCollisions(state, facts, tables);
    expect(firstBall(nextState).isActive).toBe(false);
    expect(events.some((e) => e.type === 'LifeLost')).toBe(true);
  });
});

// --- Item pickup tests ---

describe('ItemPickedUp resolution', () => {
  it('아이템 획득 → 아이템 제거 + ItemCollected + 바 width 확장', () => {
    const item: ItemDropState = {
      id: 'item_0',
      itemType: 'expand',
      x: 480,
      y: 660,
      fallSpeed: 160,
      isCollected: false,
    };
    const state = makeState({ itemDrops: [item] });
    const facts: CollisionFact[] = [{ type: 'ItemPickedUp', itemId: 'item_0' }];
    const { nextState, events } = applyCollisions(state, facts, tables);
    expect(nextState.itemDrops.length).toBe(0);
    expect(events.some((e) => e.type === 'ItemCollected')).toBe(true);
    expect(nextState.bar.width).toBeCloseTo(config.baseBarWidth * config.expandMultiplier);
    expect(nextState.bar.activeEffect).toBe('expand');
  });
});

// --- ItemFellOff tests ---

describe('ItemFellOffFloor resolution', () => {
  it('아이템 바닥 이탈 → 아이템 제거만 (이벤트 없음)', () => {
    const item: ItemDropState = {
      id: 'item_0',
      itemType: 'expand',
      x: 300,
      y: 730,
      fallSpeed: 160,
      isCollected: false,
    };
    const state = makeState({ itemDrops: [item] });
    const facts: CollisionFact[] = [{ type: 'ItemFellOffFloor', itemId: 'item_0' }];
    const { nextState, events } = applyCollisions(state, facts, tables);
    expect(nextState.itemDrops.length).toBe(0);
    expect(events.length).toBe(0);
  });
});

// ============================================================
// Bug C 재현 테스트: 벽 반사 후 위치 스냅 없음 (position snap missing)
// ============================================================

describe('Bug C regression: 벽 반사 후 공 위치 스냅', () => {
  const BALL_RADIUS = 8;
  const CANVAS_WIDTH = 720;
  const WALL_PUSH_OUT_EPSILON = 0.5;

  it('우측 벽 충돌 후 ball.x는 벽 안쪽으로 스냅된다', () => {
    // 고속 이동으로 벽을 overshoot한 상태 (x > CANVAS_WIDTH - BALL_RADIUS)
    const ball = activeBall({ x: 725, y: 300, vx: 400, vy: -200 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitWall', ballId: 'ball_0', side: 'right' }];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    expect(result.x).toBeLessThanOrEqual(CANVAS_WIDTH - BALL_RADIUS - WALL_PUSH_OUT_EPSILON + 0.001);
    expect(result.vx).toBeLessThan(0);
  });

  it('좌측 벽 충돌 후 ball.x는 벽 안쪽으로 스냅된다', () => {
    // 좌측 벽을 overshoot한 상태 (x < BALL_RADIUS)
    const ball = activeBall({ x: -3, y: 300, vx: -400, vy: -200 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitWall', ballId: 'ball_0', side: 'left' }];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    expect(result.x).toBeGreaterThanOrEqual(BALL_RADIUS + WALL_PUSH_OUT_EPSILON - 0.001);
    expect(result.vx).toBeGreaterThan(0);
  });

  it('상단 벽 충돌 후 ball.y는 벽 안쪽으로 스냅된다', () => {
    // 상단 벽을 overshoot한 상태 (y < BALL_RADIUS)
    const ball = activeBall({ x: 300, y: -2, vx: 200, vy: -400 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitWall', ballId: 'ball_0', side: 'top' }];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    expect(result.y).toBeGreaterThanOrEqual(BALL_RADIUS + WALL_PUSH_OUT_EPSILON - 0.001);
    expect(result.vy).toBeGreaterThan(0);
  });

  it('벽 반사 후 스냅된 위치에서는 detectBallWallCollisions가 재감지하지 않는다', () => {
    // 우측 벽 충돌 후 스냅 → 다음 틱 위치는 벽 안쪽이어야 함
    // x = CANVAS_WIDTH - BALL_RADIUS - 0.5 → x + BALL_RADIUS = CANVAS_WIDTH - 0.5 < CANVAS_WIDTH
    const ball = activeBall({ x: 965, y: 300, vx: 400, vy: -200 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitWall', ballId: 'ball_0', side: 'right' }];
    const { nextState } = applyCollisions(state, facts, tables);
    const snappedBall = firstBall(nextState);
    // 스냅 후: x + BALL_RADIUS < CANVAS_WIDTH이므로 우측 벽 재감지 안 됨
    expect(snappedBall.x + BALL_RADIUS).toBeLessThan(CANVAS_WIDTH);
  });
});

// ============================================================
// 자석 상태 Ball↔Bar 충돌 예외 테스트
// ============================================================

describe('BallHitBar resolution — 자석 부착 예외', () => {
  it('자석 상태에서 활성 공이 바에 닿으면 반사 대신 부착 (isActive=false, BallAttached 이벤트)', () => {
    const ball = activeBall({ x: 480, y: 650, vx: 0, vy: 200 });
    const state = makeState({
      balls: [ball],
      bar: { x: 480, y: 660, width: 120, moveSpeed: 420, activeEffect: 'magnet' },
    });
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: 0 }];
    const { nextState, events } = applyCollisions(state, facts, tables);

    // 공이 비활성화됐는지
    expect(firstBall(nextState).isActive).toBe(false);
    // 속도가 0인지
    expect(firstBall(nextState).vx).toBe(0);
    expect(firstBall(nextState).vy).toBe(0);
    // attachedBallIds에 추가됐는지
    expect(nextState.attachedBallIds).toContain('ball_0');
    // BallAttached 이벤트 발행됐는지
    expect(events.some((e) => e.type === 'BallAttached')).toBe(true);
    const attached = events.find((e) => e.type === 'BallAttached');
    if (attached?.type === 'BallAttached') {
      expect(attached.ballIds).toContain('ball_0');
    }
  });

  it('자석 상태에서 이미 비활성 공은 부착 처리하지 않음 (isActive=false → 무시)', () => {
    const ball = activeBall({ x: 480, y: 650, vx: 0, vy: 0, isActive: false });
    const state = makeState({
      balls: [ball],
      bar: { x: 480, y: 660, width: 120, moveSpeed: 420, activeEffect: 'magnet' },
    });
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: 0 }];
    const { nextState, events } = applyCollisions(state, facts, tables);

    // 비활성 공이므로 BallAttached 발행 안 됨
    expect(events.some((e) => e.type === 'BallAttached')).toBe(false);
    expect(nextState.attachedBallIds).not.toContain('ball_0');
  });

  it('자석 상태 아닐 때 (none) Ball↔Bar 충돌은 기존 반사 동작 유지', () => {
    const ball = activeBall({ vx: 0, vy: 200 });
    const state = makeState({ balls: [ball] }); // bar.activeEffect = 'none'
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: 0 }];
    const { nextState, events } = applyCollisions(state, facts, tables);

    // 반사 → 공 여전히 활성
    expect(firstBall(nextState).isActive).toBe(true);
    // vy 음수(위쪽)
    expect(firstBall(nextState).vy).toBeLessThan(0);
    // BallAttached 발행 안 됨
    expect(events.some((e) => e.type === 'BallAttached')).toBe(false);
  });

  it('자석 부착 시 부착 공 y 위치는 바 위쪽 표면 근처', () => {
    const BAR_HEIGHT_CONST = 16;
    const BALL_RADIUS_CONST = 8;
    const barY = 660;
    const ball = activeBall({ x: 480, y: barY - 20, vx: 0, vy: 200 });
    const state = makeState({
      balls: [ball],
      bar: { x: 480, y: barY, width: 120, moveSpeed: 420, activeEffect: 'magnet' },
    });
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: 0 }];
    const { nextState } = applyCollisions(state, facts, tables);

    const expectedY = barY - BAR_HEIGHT_CONST / 2 - BALL_RADIUS_CONST;
    expect(firstBall(nextState).y).toBeCloseTo(expectedY);
  });

  it('자석 부착 시 attachedOffsetX가 기록된다', () => {
    const barX = 480;
    const ballOffsetX = 30; // 바 중심에서 30px 오른쪽
    const ball = activeBall({ x: barX + ballOffsetX, y: 640, vx: 0, vy: 200 });
    const state = makeState({
      balls: [ball],
      bar: { x: barX, y: 660, width: 120, moveSpeed: 420, activeEffect: 'magnet' },
    });
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: 0.5 }];
    const { nextState } = applyCollisions(state, facts, tables);

    expect(firstBall(nextState).attachedOffsetX).toBeCloseTo(ballOffsetX);
  });
});

// ============================================================
// Bug B 재현 테스트: 반사 후 수직 교착 (vx 최소값 보장 없음)
// ============================================================

describe('Bug B regression: 반사 후 최소 각도 보장 (enforceMinAngle)', () => {
  /**
   * vx가 거의 0에 가까울 때 블록 top 충돌 후 vy만 반전되면
   * 이후 공이 순수 수직 이동을 반복하는 교착 상태가 된다.
   * 반사 결과 |vx| / speed 가 sin(15°) ≈ 0.259 이상이어야 한다.
   */
  it('블록 top 충돌 후 vx가 거의 0일 때 반사 후 |vx| >= speed * sin(15°)', () => {
    // speed ≈ 420, vx = 0.5 (거의 수직), vy = -419.99
    const speed = 420;
    const ball = activeBall({ vx: 0.5, vy: -speed + 0.001 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [
      { type: 'BallHitBlock', ballId: 'ball_0', blockId: 'block_0', side: 'top' },
    ];
    const block: BlockState = {
      id: 'block_0',
      x: 460,
      y: 200,
      remainingHits: 2,
      isDestroyed: false,
      definitionId: 'tough',
    };
    const stateWithBlock = makeState({ balls: [ball], blocks: [block] });
    const { nextState } = applyCollisions(stateWithBlock, facts, tables);
    const result = firstBall(nextState);
    const resultSpeed = Math.sqrt(result.vx * result.vx + result.vy * result.vy);
    const minVx = resultSpeed * Math.sin((15 * Math.PI) / 180);
    // 반사 후 |vx|는 최소 sin(15°) * speed 이상이어야 함
    expect(Math.abs(result.vx)).toBeGreaterThanOrEqual(minVx - 0.01);
  });

  it('벽 좌측 충돌 후 vy가 거의 0일 때 반사 후 |vy| >= speed * sin(15°)', () => {
    // 수평 교착 방지: vx = -speed, vy = 0.5
    const speed = 420;
    const ball = activeBall({ vx: -speed + 0.001, vy: 0.5 });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [
      { type: 'BallHitWall', ballId: 'ball_0', side: 'left' },
    ];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    const resultSpeed = Math.sqrt(result.vx * result.vx + result.vy * result.vy);
    const minVy = resultSpeed * Math.sin((15 * Math.PI) / 180);
    expect(Math.abs(result.vy)).toBeGreaterThanOrEqual(minVy - 0.01);
  });

  it('enforceMinAngle은 정상 각도(45도)에서 벡터를 변경하지 않는다', () => {
    const speed = 420;
    const vx = speed * Math.cos((45 * Math.PI) / 180); // ~297
    const vy = -speed * Math.sin((45 * Math.PI) / 180); // ~-297
    const ball = activeBall({ vx, vy });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [
      { type: 'BallHitWall', ballId: 'ball_0', side: 'top' },
    ];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    // 45도 반사이므로 vx는 그대로, vy는 부호 반전
    expect(result.vx).toBeCloseTo(vx, 1);
    expect(result.vy).toBeCloseTo(-vy, 1);
  });

  it('바 중앙 충돌 (contactX=0): barContactX=0이어도 enforceMinAngle에 의해 |vx|가 최소값 이상', () => {
    const speed = 420;
    const ball = activeBall({ vx: 0, vy: speed });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: 0 }];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    const resultSpeed = Math.sqrt(result.vx * result.vx + result.vy * result.vy);
    const minVx = resultSpeed * Math.sin((15 * Math.PI) / 180);
    // 바 중앙이라도 enforceMinAngle 이후 최소 vx 보장
    expect(Math.abs(result.vx)).toBeGreaterThanOrEqual(minVx - 0.01);
  });

  it('반사 후 속도 크기가 유지된다', () => {
    const speed = 420;
    const ball = activeBall({ vx: 0.5, vy: -speed + 0.001 });
    const block: BlockState = {
      id: 'block_0',
      x: 460,
      y: 200,
      remainingHits: 2,
      isDestroyed: false,
      definitionId: 'tough',
    };
    const state = makeState({ balls: [ball], blocks: [block] });
    const facts: CollisionFact[] = [
      { type: 'BallHitBlock', ballId: 'ball_0', blockId: 'block_0', side: 'top' },
    ];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    const resultSpeed = Math.sqrt(result.vx * result.vx + result.vy * result.vy);
    expect(resultSpeed).toBeCloseTo(speed, 0);
  });
});
