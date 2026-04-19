import { describe, it, expect } from 'vitest';
import { GameplayLifecycleHandler } from './GameplayLifecycleHandler';
import { StageDefinitionTable } from '../../definitions/tables/StageDefinitionTable';
import { BlockDefinitionTable } from '../../definitions/tables/BlockDefinitionTable';
import { GameplayConfigTable } from '../../definitions/tables/GameplayConfigTable';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';

const stage1 = StageDefinitionTable[0]!;
const config = GameplayConfigTable;

function makeHandler(): GameplayLifecycleHandler {
  return new GameplayLifecycleHandler(BlockDefinitionTable);
}

describe('GameplayLifecycleHandler.initializeStage', () => {
  it('블록 65개 생성', () => {
    const handler = makeHandler();
    const state = handler.initializeStage(stage1, config, config.initialLives);
    expect(state.blocks).toHaveLength(65);
  });

  it('드랍 블록(basic_drop) 6개', () => {
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
});
