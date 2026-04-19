import { describe, it, expect } from 'vitest';
import { GameplayLifecycleHandler } from './GameplayLifecycleHandler';
import { STAGE_DEFINITIONS, StageDefinitionTable } from '../../definitions/tables/StageDefinitionTable';
import { BlockDefinitionTable } from '../../definitions/tables/BlockDefinitionTable';
import { GameplayConfigTable } from '../../definitions/tables/GameplayConfigTable';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';

const stage1 = StageDefinitionTable[0]!;
const stage2 = STAGE_DEFINITIONS[1]!;
const stage3 = STAGE_DEFINITIONS[2]!;
const config = GameplayConfigTable;

function makeHandler(): GameplayLifecycleHandler {
  return new GameplayLifecycleHandler(BlockDefinitionTable);
}

describe('GameplayLifecycleHandler.initializeStage', () => {
  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('블록 65개 생성', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.blocks).toHaveLength(65);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('드랍 블록(basic_drop) 6개', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    const dropBlocks = state.blocks.filter((b) => b.definitionId === 'basic_drop');
    expect(dropBlocks).toHaveLength(6);
  });

  it('공 1개, 비활성 상태', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.balls).toHaveLength(1);
    expect(state.balls[0]!.isActive).toBe(false);
  });

  it('바 baseBarWidth 크기로 생성', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.bar.width).toBe(config.baseBarWidth);
  });

  it('바 activeEffect = none', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.bar.activeEffect).toBe('none');
  });

  it('lives = initialLives(3)', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, 3);
    expect(state.session.lives).toBe(3);
  });

  it('score = 0', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.session.score).toBe(0);
  });

  it('아이템 낙하 없음', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.itemDrops).toHaveLength(0);
  });

  it('isStageCleared = false', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.isStageCleared).toBe(false);
  });

  it('magnetRemainingTime = 0', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.magnetRemainingTime).toBe(0);
  });

  it('attachedBallIds = []', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.attachedBallIds).toHaveLength(0);
  });

  it('laserCooldownRemaining = 0', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.laserCooldownRemaining).toBe(0);
  });

  it('laserShots = []', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.laserShots).toHaveLength(0);
  });

  it('spinnerStates = [] (spinners 없는 스테이지)', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.spinnerStates).toHaveLength(0);
  });
});

describe('GameplayLifecycleHandler.resetForRetry', () => {
  function makeStateWithProgress(): GameplayRuntimeState {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, 3);
    // 블록 일부 파괴, 점수 증가, 라이프 감소, 아이템 낙하 추가, 바 효과 적용을 시뮬레이션
    return {
      ...state,
      session: { ...state.session, score: 150, lives: 2 },
      blocks: state.blocks.map((b, i) =>
        i < 5 ? { ...b, isDestroyed: true } : b,
      ),
      itemDrops: [
        {
          id: 'item_0',
          itemType: 'expand',
          x: 300,
          y: 400,
          fallSpeed: 160,
          isCollected: false,
        },
      ],
      bar: {
        ...state.bar,
        x: 200,
        y: state.bar.y,
        width: config.baseBarWidth * config.expandMultiplier,
        activeEffect: 'expand',
      },
      balls: state.balls.map((b) => ({
        ...b,
        isActive: true,
        vx: 100,
        vy: -100,
        x: 300,
        y: 400,
      })),
    };
  }

  it('블록 상태 유지 (파괴된 블록 수 유지)', () => {
    const handler = makeHandler();
    const prev = makeStateWithProgress();
    const next = handler.resetForRetry(prev, stage1, config);

    const destroyedCount = next.blocks.filter((b) => b.isDestroyed).length;
    expect(destroyedCount).toBe(5);
  });

  it('점수 유지', () => {
    const handler = makeHandler();
    const prev = makeStateWithProgress();
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.session.score).toBe(150);
  });

  it('라이프 유지', () => {
    const handler = makeHandler();
    const prev = makeStateWithProgress();
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.session.lives).toBe(2);
  });

  it('공 비활성으로 리셋', () => {
    const handler = makeHandler();
    const prev = makeStateWithProgress();
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.balls.every((b) => !b.isActive)).toBe(true);
  });

  it('공 vx, vy = 0 으로 리셋', () => {
    const handler = makeHandler();
    const prev = makeStateWithProgress();
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.balls.every((b) => b.vx === 0 && b.vy === 0)).toBe(true);
  });

  it('바 위치 barSpawnX/Y 로 리셋', () => {
    const handler = makeHandler();
    const prev = makeStateWithProgress();
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.bar.x).toBe(stage1.barSpawnX);
    expect(next.bar.y).toBe(stage1.barSpawnY);
  });

  it('아이템 낙하 제거', () => {
    const handler = makeHandler();
    const prev = makeStateWithProgress();
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.itemDrops).toHaveLength(0);
  });

  it('activeEffect = none 으로 리셋', () => {
    const handler = makeHandler();
    const prev = makeStateWithProgress();
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.bar.activeEffect).toBe('none');
  });

  it('bar.width = baseBarWidth 로 리셋', () => {
    const handler = makeHandler();
    const prev = makeStateWithProgress();
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.bar.width).toBe(config.baseBarWidth);
  });

  it('resetForRetry: magnetRemainingTime = 0', () => {
    const handler = makeHandler();
    const prev = { ...makeStateWithProgress(), magnetRemainingTime: 5000 };
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.magnetRemainingTime).toBe(0);
  });

  it('resetForRetry: attachedBallIds = []', () => {
    const handler = makeHandler();
    const prev = { ...makeStateWithProgress(), attachedBallIds: ['ball_0'] as readonly string[] };
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.attachedBallIds).toHaveLength(0);
  });

  it('resetForRetry: laserCooldownRemaining = 0', () => {
    const handler = makeHandler();
    const prev = { ...makeStateWithProgress(), laserCooldownRemaining: 800 };
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.laserCooldownRemaining).toBe(0);
  });

  it('resetForRetry: laserShots = []', () => {
    const handler = makeHandler();
    const prev = {
      ...makeStateWithProgress(),
      laserShots: [{ id: 'laser_0', x: 300, y: 200, vy: -400 }] as const,
    };
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.laserShots).toHaveLength(0);
  });

  it('resetForRetry: spinnerStates 는 그대로 유지', () => {
    const handler = makeHandler();
    const spinners = [
      { id: 'spinner_0', definitionId: 'spinner_cube', x: 100, y: 200, angleRad: 0.5 },
    ] as const;
    const prev = { ...makeStateWithProgress(), spinnerStates: spinners };
    const next = handler.resetForRetry(prev, stage1, config);
    expect(next.spinnerStates).toHaveLength(1);
    expect(next.spinnerStates[0]!.id).toBe('spinner_0');
  });
});

describe('GameplayLifecycleHandler.loadNextStage', () => {
  /**
   * stage1 기준 진행 중 상태를 만든다.
   * score=300, lives=2, 블록 일부 파괴, 바 효과=expand, 아이템 존재
   */
  function makeProgressState(): GameplayRuntimeState {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, 3);
    return {
      ...state,
      session: { ...state.session, score: 300, lives: 2, highScore: 500, currentStageIndex: 0 },
      blocks: state.blocks.map((b, i) => (i < 10 ? { ...b, isDestroyed: true } : b)),
      itemDrops: [
        {
          id: 'item_0',
          itemType: 'expand',
          x: 300,
          y: 400,
          fallSpeed: 160,
          isCollected: false,
        },
      ],
      bar: {
        ...state.bar,
        x: 200,
        y: state.bar.y,
        width: config.baseBarWidth * config.expandMultiplier,
        activeEffect: 'expand',
      },
      balls: state.balls.map((b) => ({
        ...b,
        isActive: true,
        vx: 100,
        vy: -100,
        x: 300,
        y: 400,
      })),
    };
  }

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('stage1 → stage2: 블록 수가 78개로 교체된다', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.blocks).toHaveLength(78);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('stage2 → stage3: 블록 수가 91개로 교체된다', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage3, config);
    expect(next.blocks).toHaveLength(91);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('stage1(65블록) → stage2(78블록): 이전 블록과 다른 개수', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(prev.blocks).toHaveLength(65);
    expect(next.blocks).toHaveLength(78);
    expect(next.blocks.length).not.toBe(prev.blocks.length);
  });

  it('session.score 유지', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.session.score).toBe(300);
  });

  it('session.lives 유지', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.session.lives).toBe(2);
  });

  it('session.highScore 유지', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.session.highScore).toBe(500);
  });

  it('모든 블록이 파괴되지 않은 상태로 새로 생성된다', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.blocks.every((b) => !b.isDestroyed)).toBe(true);
  });

  it('아이템 낙하 제거', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.itemDrops).toHaveLength(0);
  });

  it('공 비활성으로 리셋', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.balls.every((b) => !b.isActive)).toBe(true);
  });

  it('바 activeEffect = none 으로 리셋', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.bar.activeEffect).toBe('none');
  });

  it('바 width = baseBarWidth 로 리셋', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.bar.width).toBe(config.baseBarWidth);
  });

  it('isStageCleared = false', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.isStageCleared).toBe(false);
  });

  it('바 위치가 새 스테이지 spawn 좌표로 리셋된다', () => {
    const handler = makeHandler();
    const prev = makeProgressState();
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.bar.x).toBe(stage2.barSpawnX);
    expect(next.bar.y).toBe(stage2.barSpawnY);
  });

  it('loadNextStage: magnetRemainingTime = 0', () => {
    const handler = makeHandler();
    const prev = { ...makeProgressState(), magnetRemainingTime: 3000 };
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.magnetRemainingTime).toBe(0);
  });

  it('loadNextStage: attachedBallIds = []', () => {
    const handler = makeHandler();
    const prev = {
      ...makeProgressState(),
      attachedBallIds: ['ball_0'] as readonly string[],
    };
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.attachedBallIds).toHaveLength(0);
  });

  it('loadNextStage: laserCooldownRemaining = 0', () => {
    const handler = makeHandler();
    const prev = { ...makeProgressState(), laserCooldownRemaining: 500 };
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.laserCooldownRemaining).toBe(0);
  });

  it('loadNextStage: laserShots = []', () => {
    const handler = makeHandler();
    const prev = {
      ...makeProgressState(),
      laserShots: [{ id: 'laser_0', x: 200, y: 100, vy: -400 }] as const,
    };
    const next = handler.loadNextStage(prev, stage2, config);
    expect(next.laserShots).toHaveLength(0);
  });

  it('loadNextStage: spinnerStates가 새 스테이지 기반으로 재생성된다 (stage2 spinner 1개)', () => {
    const handler = makeHandler();
    const spinners = [
      { id: 'spinner_0', definitionId: 'spinner_cube', x: 100, y: 200, angleRad: 1.2 },
    ] as const;
    const prev = { ...makeProgressState(), spinnerStates: spinners };
    const next = handler.loadNextStage(prev, stage2, config);
    // stage2에 spinner_cube 1개 — 이전 spinnerStates는 버려지고 새 스테이지 데이터로 재생성된다
    expect(next.spinnerStates).toHaveLength(1);
    expect(next.spinnerStates[0]!.definitionId).toBe('spinner_cube');
  });
});
