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
  it('바 중앙 충돌 → vy 음수(위쪽), vx 0에 가까움', () => {
    const speed = 420;
    const ball = activeBall({ vx: 0, vy: speed });
    const state = makeState({ balls: [ball] });
    const facts: CollisionFact[] = [{ type: 'BallHitBar', ballId: 'ball_0', barContactX: 0 }];
    const { nextState } = applyCollisions(state, facts, tables);
    const result = firstBall(nextState);
    expect(result.vy).toBeLessThan(0);
    expect(Math.abs(result.vx)).toBeLessThan(speed * 0.1); // near 0
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
