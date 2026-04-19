import { describe, it, expect } from 'vitest';
import { judgeStageOutcome } from './StageRuleService';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { BlockState } from '../state/BlockState';
import type { GameplayEvent } from '../events/gameplayEvents';

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

function livingBlock(id: string): BlockState {
  return { id, x: 100, y: 100, remainingHits: 1, isDestroyed: false, definitionId: 'basic' };
}

function destroyedBlock(id: string): BlockState {
  return { id, x: 100, y: 100, remainingHits: 0, isDestroyed: true, definitionId: 'basic' };
}

describe('judgeStageOutcome', () => {
  it('일반 상태 → none', () => {
    const state = makeState({ blocks: [livingBlock('b0')] });
    const result = judgeStageOutcome(state, []);
    expect(result.kind).toBe('none');
  });

  it('모든 블록 파괴 → clear', () => {
    const state = makeState({
      blocks: [destroyedBlock('b0'), destroyedBlock('b1')],
    });
    const result = judgeStageOutcome(state, []);
    expect(result.kind).toBe('clear');
  });

  it('LifeLost + lives > 1 → lifeLost (remainingLives 포함)', () => {
    const state = makeState({
      blocks: [livingBlock('b0')],
      session: { currentStageIndex: 0, score: 0, lives: 3, highScore: 0 },
    });
    const events: GameplayEvent[] = [{ type: 'LifeLost', remainingLives: 0 }];
    const result = judgeStageOutcome(state, events);
    expect(result.kind).toBe('lifeLost');
    if (result.kind === 'lifeLost') {
      expect(result.remainingLives).toBe(2); // 3 - 1
    }
  });

  it('LifeLost + lives === 1 → gameOver', () => {
    const state = makeState({
      blocks: [livingBlock('b0')],
      session: { currentStageIndex: 0, score: 0, lives: 1, highScore: 0 },
    });
    const events: GameplayEvent[] = [{ type: 'LifeLost', remainingLives: 0 }];
    const result = judgeStageOutcome(state, events);
    expect(result.kind).toBe('gameOver');
  });

  it('LifeLost + lives === 0 → gameOver (lives가 이미 0인 경우)', () => {
    const state = makeState({
      blocks: [livingBlock('b0')],
      session: { currentStageIndex: 0, score: 0, lives: 0, highScore: 0 },
    });
    const events: GameplayEvent[] = [{ type: 'LifeLost', remainingLives: 0 }];
    const result = judgeStageOutcome(state, events);
    expect(result.kind).toBe('gameOver');
  });

  it('우선순위: gameOver > lifeLost > clear > none', () => {
    // All blocks destroyed AND a life was lost on the same tick (edge case)
    const state = makeState({
      blocks: [destroyedBlock('b0')],
      session: { currentStageIndex: 0, score: 0, lives: 1, highScore: 0 },
    });
    const events: GameplayEvent[] = [{ type: 'LifeLost', remainingLives: 0 }];
    const result = judgeStageOutcome(state, events);
    // gameOver takes priority over clear
    expect(result.kind).toBe('gameOver');
  });

  it('블록이 없으면 clear를 감지하지 않는다', () => {
    const state = makeState({ blocks: [] });
    const result = judgeStageOutcome(state, []);
    expect(result.kind).toBe('none');
  });
});
