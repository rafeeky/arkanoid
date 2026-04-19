import { describe, it, expect } from 'vitest';
import { nextState } from './FlowTransitionPolicy';
import type { FlowCommand } from './FlowTransitionPolicy';

// Helper factories
const startGame: FlowCommand = { type: 'StartGameRequested' };
const roundIntroFinished: FlowCommand = { type: 'RoundIntroFinished' };
const lifeLostWithLives = (remainingLives: number): FlowCommand => ({
  type: 'LifeLost',
  remainingLives,
});
const gameOverConditionMet: FlowCommand = { type: 'GameOverConditionMet' };
const stageCleared: FlowCommand = { type: 'StageCleared' };
const retryRequested: FlowCommand = { type: 'RetryRequested' };

describe('FlowTransitionPolicy — nextState()', () => {
  describe('Title 상태에서 유효 전이', () => {
    it('Title + StartGameRequested → RoundIntro', () => {
      expect(nextState('title', startGame)).toBe('roundIntro');
    });
  });

  describe('RoundIntro 상태에서 유효 전이', () => {
    it('RoundIntro + RoundIntroFinished → InGame', () => {
      expect(nextState('roundIntro', roundIntroFinished)).toBe('inGame');
    });
  });

  describe('InGame 상태에서 유효 전이', () => {
    it('InGame + LifeLost(remainingLives=2) → RoundIntro', () => {
      expect(nextState('inGame', lifeLostWithLives(2))).toBe('roundIntro');
    });

    it('InGame + LifeLost(remainingLives=1) → RoundIntro', () => {
      expect(nextState('inGame', lifeLostWithLives(1))).toBe('roundIntro');
    });

    it('InGame + GameOverConditionMet → GameOver', () => {
      expect(nextState('inGame', gameOverConditionMet)).toBe('gameOver');
    });

    it('InGame + StageCleared → Title (MVP1 임시 처리)', () => {
      expect(nextState('inGame', stageCleared)).toBe('title');
    });
  });

  describe('GameOver 상태에서 유효 전이', () => {
    it('GameOver + RetryRequested → Title', () => {
      expect(nextState('gameOver', retryRequested)).toBe('title');
    });
  });

  describe('무효 조합 — null 반환', () => {
    it('Title + LifeLost → null', () => {
      expect(nextState('title', lifeLostWithLives(2))).toBeNull();
    });

    it('Title + RetryRequested → null', () => {
      expect(nextState('title', retryRequested)).toBeNull();
    });

    it('Title + RoundIntroFinished → null', () => {
      expect(nextState('title', roundIntroFinished)).toBeNull();
    });

    it('RoundIntro + StartGameRequested → null', () => {
      expect(nextState('roundIntro', startGame)).toBeNull();
    });

    it('RoundIntro + LifeLost → null', () => {
      expect(nextState('roundIntro', lifeLostWithLives(2))).toBeNull();
    });

    it('GameOver + LifeLost → null', () => {
      expect(nextState('gameOver', lifeLostWithLives(2))).toBeNull();
    });

    it('InGame + LifeLost(remainingLives=0) → null (Controller가 GameOverConditionMet으로 변환)', () => {
      // Policy 레벨에서는 remainingLives=0 LifeLost 는 null.
      // Controller 가 이를 GameOverConditionMet 으로 변환해서 다시 넘긴다.
      expect(nextState('inGame', lifeLostWithLives(0))).toBeNull();
    });
  });
});
