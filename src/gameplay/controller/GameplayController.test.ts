import { describe, it, expect } from 'vitest';
import { GameplayController } from './GameplayController';
import { createGameplayRuntimeFromStageDefinition } from '../systems/StageRuntimeFactory';
import type { StageDefinition } from '../../definitions/types/StageDefinition';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { ItemDefinition } from '../../definitions/types/ItemDefinition';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { InputSnapshot } from '../../input/InputSnapshot';

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
    displayNameTextId: '',
    descriptionTextId: '',
    iconId: '',
    fallSpeed: 160,
    effectType: 'expand',
    expandMultiplier: 1.5,
  },
};

const deps = { blockDefinitions, itemDefinitions, config };

// A simple stage with 2 basic blocks in row 0
const simpleStage: StageDefinition = {
  stageId: 'test',
  displayName: 'Test',
  backgroundId: 'bg',
  barSpawnX: 480,
  barSpawnY: 660,
  ballSpawnX: 480,
  ballSpawnY: 600,
  ballInitialSpeed: 420,
  ballInitialAngleDeg: -60,
  blocks: [
    { row: 0, col: 0, definitionId: 'basic' },
    { row: 0, col: 1, definitionId: 'basic' },
  ],
};

const noInput: InputSnapshot = { leftDown: false, rightDown: false, spaceJustPressed: false };
const leftInput: InputSnapshot = { leftDown: true, rightDown: false, spaceJustPressed: false };
const rightInput: InputSnapshot = { leftDown: false, rightDown: true, spaceJustPressed: false };
const spaceInput: InputSnapshot = { leftDown: false, rightDown: false, spaceJustPressed: true };

function makeController(stage: StageDefinition = simpleStage, lives = 3): GameplayController {
  const initialState = createGameplayRuntimeFromStageDefinition(
    stage,
    config,
    blockDefinitions,
    lives,
  );
  return new GameplayController(initialState, deps);
}

function getBall(state: GameplayRuntimeState) {
  const b = state.balls[0];
  if (!b) throw new Error('No ball in state');
  return b;
}

function getBlock(state: GameplayRuntimeState, index = 0) {
  const b = state.blocks[index];
  if (!b) throw new Error(`No block at index ${index}`);
  return b;
}

// --- Tests ---

describe('GameplayController - 바 이동', () => {
  it('Stage 로드 후 tick에서 바가 오른쪽으로 이동한다', () => {
    const ctrl = makeController();
    const initialX = ctrl.getState().bar.x;
    ctrl.tick(rightInput, 1 / 60);
    expect(ctrl.getState().bar.x).toBeGreaterThan(initialX);
  });

  it('좌측 입력으로 바가 왼쪽으로 이동한다', () => {
    const ctrl = makeController();
    const initialX = ctrl.getState().bar.x;
    ctrl.tick(leftInput, 1 / 60);
    expect(ctrl.getState().bar.x).toBeLessThan(initialX);
  });

  it('입력 없으면 바가 이동하지 않는다', () => {
    const ctrl = makeController();
    const initialX = ctrl.getState().bar.x;
    ctrl.tick(noInput, 1 / 60);
    expect(ctrl.getState().bar.x).toBe(initialX);
  });
});

describe('GameplayController - 공 발사', () => {
  it('스페이스 입력으로 공이 발사된다', () => {
    const ctrl = makeController();
    expect(getBall(ctrl.getState()).isActive).toBe(false);
    const events = ctrl.tick(spaceInput, 1 / 60);
    expect(getBall(ctrl.getState()).isActive).toBe(true);
    expect(events.some((e) => e.type === 'BallLaunched')).toBe(true);
  });

  it('발사 후 공이 위쪽으로 이동한다', () => {
    const ctrl = makeController();
    ctrl.tick(spaceInput, 1 / 60); // launch
    const yAfterLaunch = getBall(ctrl.getState()).y;
    ctrl.tick(noInput, 1 / 60);
    expect(getBall(ctrl.getState()).y).toBeLessThan(yAfterLaunch);
  });
});

describe('GameplayController - 벽 반사', () => {
  it('공이 우측 벽에 닿으면 vx가 반전된다', () => {
    const initialState = createGameplayRuntimeFromStageDefinition(
      simpleStage,
      config,
      blockDefinitions,
      3,
    );
    const baseBall = getBall(initialState);
    const modState: GameplayRuntimeState = {
      ...initialState,
      balls: [{ ...baseBall, isActive: true, x: 956, y: 400, vx: 200, vy: 0 }],
    };
    const ctrl = new GameplayController(modState, deps);
    ctrl.tick(noInput, 1 / 60);
    expect(getBall(ctrl.getState()).vx).toBeLessThan(0);
  });
});

describe('GameplayController - 블록 충돌 및 점수', () => {
  it('공이 블록에 맞으면 점수가 올라간다', () => {
    const initialState = createGameplayRuntimeFromStageDefinition(
      simpleStage,
      config,
      blockDefinitions,
      3,
    );
    const firstBlock = getBlock(initialState, 0);
    const baseBall = getBall(initialState);
    const modState: GameplayRuntimeState = {
      ...initialState,
      balls: [{ ...baseBall, id: 'ball_0', x: firstBlock.x + 32, y: firstBlock.y + 12, vx: 0, vy: 100, isActive: true }],
    };
    const ctrl = new GameplayController(modState, deps);
    ctrl.tick(noInput, 1 / 60);
    expect(ctrl.getState().session.score).toBeGreaterThan(0);
  });

  it('블록이 파괴되면 BlockDestroyed 이벤트가 반환된다', () => {
    const initialState = createGameplayRuntimeFromStageDefinition(
      simpleStage,
      config,
      blockDefinitions,
      3,
    );
    const firstBlock = getBlock(initialState, 0);
    const baseBall = getBall(initialState);
    const modState: GameplayRuntimeState = {
      ...initialState,
      balls: [{ ...baseBall, id: 'ball_0', x: firstBlock.x + 32, y: firstBlock.y + 12, vx: 0, vy: 100, isActive: true }],
    };
    const ctrl = new GameplayController(modState, deps);
    const events = ctrl.tick(noInput, 1 / 60);
    expect(events.some((e) => e.type === 'BlockDestroyed')).toBe(true);
  });
});

describe('GameplayController - 바닥 낙하 → 라이프 감소', () => {
  it('공이 바닥으로 떨어지면 라이프가 감소한다', () => {
    const initialState = createGameplayRuntimeFromStageDefinition(
      simpleStage,
      config,
      blockDefinitions,
      3,
    );
    const baseBall = getBall(initialState);
    const modState: GameplayRuntimeState = {
      ...initialState,
      balls: [{ ...baseBall, id: 'ball_0', x: 480, y: 730, vx: 0, vy: 100, isActive: true }],
    };
    const ctrl = new GameplayController(modState, deps);
    ctrl.tick(noInput, 1 / 60);
    expect(ctrl.getState().session.lives).toBe(2);
  });

  it('공 바닥 낙하 → LifeLost 이벤트 + remainingLives 포함', () => {
    const initialState = createGameplayRuntimeFromStageDefinition(
      simpleStage,
      config,
      blockDefinitions,
      3,
    );
    const baseBall = getBall(initialState);
    const modState: GameplayRuntimeState = {
      ...initialState,
      balls: [{ ...baseBall, id: 'ball_0', x: 480, y: 730, vx: 0, vy: 100, isActive: true }],
    };
    const ctrl = new GameplayController(modState, deps);
    const events = ctrl.tick(noInput, 1 / 60);
    const lifeLostEvent = events.find((e) => e.type === 'LifeLost');
    expect(lifeLostEvent).toBeDefined();
    if (lifeLostEvent && lifeLostEvent.type === 'LifeLost') {
      expect(lifeLostEvent.remainingLives).toBe(2);
    }
  });

  it('lives === 1일 때 바닥 낙하 → GameOverConditionMet', () => {
    const initialState = createGameplayRuntimeFromStageDefinition(
      simpleStage,
      config,
      blockDefinitions,
      1,
    );
    const baseBall = getBall(initialState);
    const modState: GameplayRuntimeState = {
      ...initialState,
      balls: [{ ...baseBall, id: 'ball_0', x: 480, y: 730, vx: 0, vy: 100, isActive: true }],
    };
    const ctrl = new GameplayController(modState, deps);
    const events = ctrl.tick(noInput, 1 / 60);
    expect(events.some((e) => e.type === 'GameOverConditionMet')).toBe(true);
    expect(ctrl.getState().session.lives).toBe(0);
  });
});

describe('GameplayController - 스테이지 클리어', () => {
  it('모든 블록 파괴 → StageCleared 이벤트', () => {
    const singleBlockStage: StageDefinition = {
      ...simpleStage,
      blocks: [{ row: 0, col: 0, definitionId: 'basic' }],
    };
    const initialState = createGameplayRuntimeFromStageDefinition(
      singleBlockStage,
      config,
      blockDefinitions,
      3,
    );
    const firstBlock = getBlock(initialState, 0);
    const baseBall = getBall(initialState);
    const modState: GameplayRuntimeState = {
      ...initialState,
      balls: [
        { ...baseBall, id: 'ball_0', x: firstBlock.x + 32, y: firstBlock.y + 12, vx: 0, vy: 100, isActive: true },
      ],
    };
    const ctrl = new GameplayController(modState, deps);
    const events = ctrl.tick(noInput, 1 / 60);
    expect(events.some((e) => e.type === 'StageCleared')).toBe(true);
    expect(ctrl.getState().isStageCleared).toBe(true);
  });
});
