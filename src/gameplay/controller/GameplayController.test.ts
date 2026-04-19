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

// ============================================================
// Tunneling regression tests (swept AABB)
// ============================================================

describe('터널링 회귀 테스트 — swept AABB 충돌', () => {
  /**
   * 공이 dt=0.016(60fps) 한 틱에 블록 영역을 완전히 통과할 수 있는 속도로 이동.
   * 블록 x=150, y=280, 64x24.
   * 공 초기 위치 (100, 300), 속도 (550, -300) 대각선.
   * 한 틱 후 공의 이동거리 ≈ 10px — 블록에 맞아야 한다.
   * 이전 구현(probe-stop)에서는 블록 충돌 이벤트가 누락됐으나
   * swept AABB 구현에서는 BlockHit 또는 BlockDestroyed 이벤트가 발행돼야 한다.
   */
  it('정상 속도 공이 블록에 충돌하면 BlockHit/BlockDestroyed 이벤트가 발행된다', () => {
    const blockX = 150;
    const blockY = 280;

    // Stage with one block at the target position
    const targetStage: StageDefinition = {
      ...simpleStage,
      blocks: [{ row: 0, col: 0, definitionId: 'basic' }],
    };
    const initialState = createGameplayRuntimeFromStageDefinition(
      targetStage,
      config,
      blockDefinitions,
      3,
    );

    // Place ball just to the left of the block, moving right-upward diagonally
    // Block is at x=40, y=80 from factory — override with a custom state
    const modState: GameplayRuntimeState = {
      ...initialState,
      blocks: [
        { id: 'block_target', x: blockX, y: blockY, remainingHits: 1, isDestroyed: false, definitionId: 'basic' },
      ],
      balls: [
        { id: 'ball_0', x: 100, y: 300, vx: 550, vy: -300, isActive: true },
      ],
    };

    const ctrl = new GameplayController(modState, deps);
    // Run several ticks so the ball definitely reaches the block
    const hitEvents: { type: string }[] = [];
    for (let i = 0; i < 10; i++) {
      const events = ctrl.tick(noInput, 0.016);
      for (const e of events) {
        if (e.type === 'BlockHit' || e.type === 'BlockDestroyed') {
          hitEvents.push(e);
        }
      }
      if (hitEvents.length > 0) break;
    }

    expect(hitEvents.length).toBeGreaterThan(0);
  });

  /**
   * 고속 공 터널링 테스트.
   * 공 속도 600 px/s, dt=0.016 → 이동거리 ≈ 9.6px (블록 높이 24px보다 작으므로 단일 틱 통과 가능).
   * 공이 블록 바로 앞에서 시작하여 한 틱에 블록을 통과하는 시나리오.
   * 블록 x=200, y=280, 공 x=190, y=291 (블록 왼쪽 edge 근처).
   */
  it('블록 바로 앞에서 한 틱에 충돌이 발생한다', () => {
    const blockX = 200;
    const blockY = 280;
    const modState: GameplayRuntimeState = {
      session: { currentStageIndex: 0, score: 0, lives: 3, highScore: 0 },
      bar: { x: 480, y: 660, width: 120, moveSpeed: 420, activeEffect: 'none' },
      blocks: [
        { id: 'blk', x: blockX, y: blockY, remainingHits: 1, isDestroyed: false, definitionId: 'basic' },
      ],
      balls: [
        // Ball is 8px radius, block left edge at 200. Ball center at 183 → edge at 191.
        // Moving right at 600px/s. After one 16ms tick: x = 183 + 600*0.016 = 192.6
        // Swept AABB should detect entry into block's expanded zone.
        { id: 'ball_0', x: 183, y: blockY + 12, vx: 600, vy: 0, isActive: true },
      ],
      itemDrops: [],
      isStageCleared: false,
    };

    const ctrl = new GameplayController(modState, deps);
    const events = ctrl.tick(noInput, 0.016);
    const blockEvents = events.filter((e) => e.type === 'BlockHit' || e.type === 'BlockDestroyed');
    expect(blockEvents.length).toBeGreaterThan(0);

    // After collision, ball should have reversed vx (bounced off left face)
    const ball = getBall(ctrl.getState());
    expect(ball.vx).toBeLessThan(0);
  });

  /**
   * 공이 연속된 두 블록을 한 틱에 통과하지 않는다.
   * 두 블록이 x 방향으로 나란히 배치. 공이 첫 번째 블록에 맞으면 반사돼야 한다.
   */
  it('연속된 블록 배치에서 첫 번째 블록에서 반사된다', () => {
    const modState: GameplayRuntimeState = {
      session: { currentStageIndex: 0, score: 0, lives: 3, highScore: 0 },
      bar: { x: 480, y: 660, width: 120, moveSpeed: 420, activeEffect: 'none' },
      blocks: [
        { id: 'blk0', x: 200, y: 280, remainingHits: 1, isDestroyed: false, definitionId: 'basic' },
        { id: 'blk1', x: 268, y: 280, remainingHits: 1, isDestroyed: false, definitionId: 'basic' },
      ],
      balls: [
        // Ball approaching first block from the left
        { id: 'ball_0', x: 183, y: 292, vx: 600, vy: 0, isActive: true },
      ],
      itemDrops: [],
      isStageCleared: false,
    };

    const ctrl = new GameplayController(modState, deps);
    const events = ctrl.tick(noInput, 0.016);

    // Only first block should register a hit
    const blockEvents = events.filter(
      (e): e is { type: 'BlockHit'; blockId: string; remainingHits: number } | { type: 'BlockDestroyed'; blockId: string; scoreDelta: number } =>
        e.type === 'BlockHit' || e.type === 'BlockDestroyed',
    );
    expect(blockEvents.length).toBe(1);
    expect(blockEvents[0]).toBeDefined();
    // The hit block must be blk0 (first one in path)
    if (blockEvents[0] && 'blockId' in blockEvents[0]) {
      expect(blockEvents[0].blockId).toBe('blk0');
    }

    // Ball should have reversed vx
    const ball = getBall(ctrl.getState());
    expect(ball.vx).toBeLessThan(0);
  });
});
