import { describe, it, expect } from 'vitest';
import { detectCollisions } from './CollisionService';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { BallState } from '../state/BallState';
import type { BarState } from '../state/BarState';
import type { BlockState } from '../state/BlockState';
import type { ItemDropState } from '../state/ItemDropState';

// --- Fixture helpers ---

function makeState(overrides: Partial<GameplayRuntimeState> = {}): GameplayRuntimeState {
  return {
    session: { currentStageIndex: 0, score: 0, lives: 3, highScore: 0 },
    bar: {
      x: 480,
      y: 660,
      width: 120,
      moveSpeed: 420,
      activeEffect: 'none',
    },
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
  return {
    id: 'ball_0',
    x: 480,
    y: 600,
    vx: 0,
    vy: 100,
    isActive: true,
    ...overrides,
  };
}

function makeBar(overrides: Partial<BarState> = {}): BarState {
  return {
    x: 480,
    y: 660,
    width: 120,
    moveSpeed: 420,
    activeEffect: 'none',
    ...overrides,
  };
}

function makeBlock(overrides: Partial<BlockState> = {}): BlockState {
  return {
    id: 'block_0',
    x: 200,
    y: 100,
    remainingHits: 1,
    isDestroyed: false,
    definitionId: 'basic',
    ...overrides,
  };
}

// --- Wall collision tests ---

describe('BallHitWall detection', () => {
  it('공이 좌측 벽에 부딪힌다 (x <= BALL_RADIUS)', () => {
    const ball = activeBall({ x: 4, y: 400, vx: -100, vy: 0 });
    const state = makeState({ balls: [ball] });
    const facts = detectCollisions(state, state);
    expect(facts).toContainEqual({ type: 'BallHitWall', ballId: 'ball_0', side: 'left' });
  });

  it('공이 우측 벽에 부딪힌다 (x >= 960 - BALL_RADIUS)', () => {
    const ball = activeBall({ x: 956, y: 400, vx: 100, vy: 0 });
    const state = makeState({ balls: [ball] });
    const facts = detectCollisions(state, state);
    expect(facts).toContainEqual({ type: 'BallHitWall', ballId: 'ball_0', side: 'right' });
  });

  it('공이 상단 벽에 부딪힌다 (y <= BALL_RADIUS)', () => {
    const ball = activeBall({ x: 400, y: 4, vx: 0, vy: -100 });
    const state = makeState({ balls: [ball] });
    const facts = detectCollisions(state, state);
    expect(facts).toContainEqual({ type: 'BallHitWall', ballId: 'ball_0', side: 'top' });
  });
});

// --- Floor collision tests ---

describe('BallHitFloor detection', () => {
  it('공이 y > 720이면 BallHitFloor를 감지한다', () => {
    const ball = activeBall({ x: 400, y: 730 });
    const state = makeState({ balls: [ball] });
    const facts = detectCollisions(state, state);
    expect(facts).toContainEqual({ type: 'BallHitFloor', ballId: 'ball_0' });
  });

  it('공이 y = 720 이내이면 BallHitFloor를 감지하지 않는다', () => {
    const ball = activeBall({ x: 400, y: 700 });
    const state = makeState({ balls: [ball] });
    const facts = detectCollisions(state, state);
    expect(facts.some((f) => f.type === 'BallHitFloor')).toBe(false);
  });
});

// --- Bar collision tests ---

describe('BallHitBar detection', () => {
  it('바 중앙에서 바에 부딪히면 barContactX = 0', () => {
    const bar = makeBar({ x: 480, y: 660, width: 120 });
    // Ball at bar center, moving down
    const ball = activeBall({ x: 480, y: 652, vx: 0, vy: 100 });
    const prevBall = { ...ball, y: 640 }; // came from above
    const state = makeState({ balls: [ball], bar });
    const prevState = makeState({ balls: [prevBall], bar });
    const facts = detectCollisions(state, prevState);
    const barFact = facts.find((f) => f.type === 'BallHitBar');
    expect(barFact).toBeDefined();
    if (barFact && barFact.type === 'BallHitBar') {
      expect(barFact.barContactX).toBeCloseTo(0, 1);
    }
  });

  it('바 좌측 끝에서 부딪히면 barContactX = -1', () => {
    const bar = makeBar({ x: 480, y: 660, width: 120 });
    // Left edge of bar is at 480 - 60 = 420
    const ball = activeBall({ x: 420, y: 652, vx: -100, vy: 100 });
    const prevBall = { ...ball, y: 640, vy: 100 };
    const state = makeState({ balls: [ball], bar });
    const prevState = makeState({ balls: [prevBall], bar });
    const facts = detectCollisions(state, prevState);
    const barFact = facts.find((f) => f.type === 'BallHitBar');
    expect(barFact).toBeDefined();
    if (barFact && barFact.type === 'BallHitBar') {
      expect(barFact.barContactX).toBeCloseTo(-1, 1);
    }
  });

  it('바 우측 끝에서 부딪히면 barContactX = +1', () => {
    const bar = makeBar({ x: 480, y: 660, width: 120 });
    // Right edge is at 480 + 60 = 540
    const ball = activeBall({ x: 540, y: 652, vx: 100, vy: 100 });
    const prevBall = { ...ball, y: 640, vy: 100 };
    const state = makeState({ balls: [ball], bar });
    const prevState = makeState({ balls: [prevBall], bar });
    const facts = detectCollisions(state, prevState);
    const barFact = facts.find((f) => f.type === 'BallHitBar');
    expect(barFact).toBeDefined();
    if (barFact && barFact.type === 'BallHitBar') {
      expect(barFact.barContactX).toBeCloseTo(1, 1);
    }
  });

  it('공이 위로 올라가는 중에는 바 충돌을 감지하지 않는다', () => {
    const bar = makeBar({ x: 480, y: 660, width: 120 });
    const ball = activeBall({ x: 480, y: 652, vx: 0, vy: -100 });
    const prevBall = { ...ball, vy: -100 };
    const state = makeState({ balls: [ball], bar });
    const prevState = makeState({ balls: [prevBall], bar });
    const facts = detectCollisions(state, prevState);
    expect(facts.some((f) => f.type === 'BallHitBar')).toBe(false);
  });
});

// --- Block collision tests ---

describe('BallHitBlock detection', () => {
  it('공이 블록 위에서 충돌하면 side = top', () => {
    // Block at (200, 100), 64x24. Center = (232, 112)
    const block = makeBlock({ x: 200, y: 100 });
    // Ball coming from above center
    const ball = activeBall({ x: 232, y: 108, vx: 0, vy: 100 });
    const prevBall = { ...ball, y: 80 }; // was above block
    const state = makeState({ balls: [ball], blocks: [block] });
    const prevState = makeState({ balls: [prevBall], blocks: [block] });
    const facts = detectCollisions(state, prevState);
    const blockFact = facts.find((f) => f.type === 'BallHitBlock');
    expect(blockFact).toBeDefined();
    if (blockFact && blockFact.type === 'BallHitBlock') {
      expect(blockFact.side).toBe('top');
    }
  });

  it('공이 블록 아래에서 충돌하면 side = bottom', () => {
    const block = makeBlock({ x: 200, y: 100 });
    // Ball coming from below center
    const ball = activeBall({ x: 232, y: 118, vx: 0, vy: -100 });
    const prevBall = { ...ball, y: 140 }; // was below block
    const state = makeState({ balls: [ball], blocks: [block] });
    const prevState = makeState({ balls: [prevBall], blocks: [block] });
    const facts = detectCollisions(state, prevState);
    const blockFact = facts.find((f) => f.type === 'BallHitBlock');
    expect(blockFact).toBeDefined();
    if (blockFact && blockFact.type === 'BallHitBlock') {
      expect(blockFact.side).toBe('bottom');
    }
  });

  it('공이 블록 좌측에서 충돌하면 side = left', () => {
    const block = makeBlock({ x: 200, y: 100 });
    // Ball coming from left of center, hit the left face
    const ball = activeBall({ x: 204, y: 112, vx: 100, vy: 0 });
    const prevBall = { ...ball, x: 180 }; // was to the left
    const state = makeState({ balls: [ball], blocks: [block] });
    const prevState = makeState({ balls: [prevBall], blocks: [block] });
    const facts = detectCollisions(state, prevState);
    const blockFact = facts.find((f) => f.type === 'BallHitBlock');
    expect(blockFact).toBeDefined();
    if (blockFact && blockFact.type === 'BallHitBlock') {
      expect(blockFact.side).toBe('left');
    }
  });

  it('공이 블록 우측에서 충돌하면 side = right', () => {
    const block = makeBlock({ x: 200, y: 100 });
    // Ball coming from right side
    const ball = activeBall({ x: 258, y: 112, vx: -100, vy: 0 });
    const prevBall = { ...ball, x: 280 }; // was to the right
    const state = makeState({ balls: [ball], blocks: [block] });
    const prevState = makeState({ balls: [prevBall], blocks: [block] });
    const facts = detectCollisions(state, prevState);
    const blockFact = facts.find((f) => f.type === 'BallHitBlock');
    expect(blockFact).toBeDefined();
    if (blockFact && blockFact.type === 'BallHitBlock') {
      expect(blockFact.side).toBe('right');
    }
  });

  it('여러 블록과 겹칠 때 가장 가까운 블록 1개만 반환한다', () => {
    // Two blocks side by side
    const block1 = makeBlock({ id: 'block_0', x: 200, y: 100 });
    const block2 = makeBlock({ id: 'block_1', x: 264, y: 100 }); // adjacent with gap=0
    // Ball between them
    const ball = activeBall({ x: 230, y: 112, vx: 0, vy: -100 });
    const prevBall = { ...ball, y: 80 };
    const state = makeState({ balls: [ball], blocks: [block1, block2] });
    const prevState = makeState({ balls: [prevBall], blocks: [block1, block2] });
    const facts = detectCollisions(state, prevState);
    const blockFacts = facts.filter((f) => f.type === 'BallHitBlock');
    expect(blockFacts.length).toBe(1);
  });

  it('파괴된 블록은 충돌을 감지하지 않는다', () => {
    const block = makeBlock({ isDestroyed: true });
    const ball = activeBall({ x: 232, y: 112, vx: 0, vy: 100 });
    const state = makeState({ balls: [ball], blocks: [block] });
    const facts = detectCollisions(state, state);
    expect(facts.some((f) => f.type === 'BallHitBlock')).toBe(false);
  });
});

// --- Item collision tests ---

describe('ItemPickedUp detection', () => {
  it('아이템이 바 AABB와 겹치면 ItemPickedUp을 감지한다', () => {
    const bar = makeBar({ x: 480, y: 660, width: 120 });
    const item: ItemDropState = {
      id: 'item_0',
      itemType: 'expand',
      x: 480, // center of bar
      y: 660, // same y as bar
      fallSpeed: 160,
      isCollected: false,
    };
    const state = makeState({ bar, itemDrops: [item] });
    const facts = detectCollisions(state, state);
    expect(facts).toContainEqual({ type: 'ItemPickedUp', itemId: 'item_0' });
  });
});

describe('ItemFellOffFloor detection', () => {
  it('아이템이 y > 720이면 ItemFellOffFloor를 감지한다', () => {
    const item: ItemDropState = {
      id: 'item_0',
      itemType: 'expand',
      x: 300,
      y: 730,
      fallSpeed: 160,
      isCollected: false,
    };
    const state = makeState({ itemDrops: [item] });
    const facts = detectCollisions(state, state);
    expect(facts).toContainEqual({ type: 'ItemFellOffFloor', itemId: 'item_0' });
  });

  it('수집된 아이템은 낙하 감지를 하지 않는다', () => {
    const item: ItemDropState = {
      id: 'item_0',
      itemType: 'expand',
      x: 300,
      y: 730,
      fallSpeed: 160,
      isCollected: true,
    };
    const state = makeState({ itemDrops: [item] });
    const facts = detectCollisions(state, state);
    expect(facts.some((f) => f.type === 'ItemFellOffFloor')).toBe(false);
  });
});
