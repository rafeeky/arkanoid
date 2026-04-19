import { describe, it, expect } from 'vitest';
import { ScreenDirector } from './ScreenDirector';
import type { GameFlowState } from '../../flow/state/GameFlowState';

const ROUND_INTRO_DURATION = 1500;

function makeFlow(kind: GameFlowState['kind']): Readonly<GameFlowState> {
  return { kind, currentStageIndex: 0 };
}

describe('ScreenDirector', () => {
  describe('currentScreen 동기화', () => {
    it('flowState.kind === title 이면 currentScreen = title', () => {
      const director = new ScreenDirector(ROUND_INTRO_DURATION);
      director.update(makeFlow('title'), 16);
      expect(director.getScreenState().currentScreen).toBe('title');
    });

    it('flowState.kind === inGame 이면 currentScreen = inGame', () => {
      const director = new ScreenDirector(ROUND_INTRO_DURATION);
      director.update(makeFlow('inGame'), 16);
      expect(director.getScreenState().currentScreen).toBe('inGame');
    });

    it('flowState.kind === gameOver 이면 currentScreen = gameOver', () => {
      const director = new ScreenDirector(ROUND_INTRO_DURATION);
      director.update(makeFlow('gameOver'), 16);
      expect(director.getScreenState().currentScreen).toBe('gameOver');
    });
  });

  describe('roundIntroRemainingTime', () => {
    it('roundIntro 진입 시 roundIntroRemainingTime = roundIntroDurationMs 로 리셋된다', () => {
      const director = new ScreenDirector(ROUND_INTRO_DURATION);
      // inGame 상태로 이동 후
      director.update(makeFlow('inGame'), 100);
      // roundIntro 로 진입
      director.update(makeFlow('roundIntro'), 0);
      expect(director.getScreenState().roundIntroRemainingTime).toBe(ROUND_INTRO_DURATION);
    });

    it('roundIntro 중 deltaMs 만큼 감소한다', () => {
      const director = new ScreenDirector(ROUND_INTRO_DURATION);
      director.update(makeFlow('roundIntro'), 0);   // 진입 (리셋)
      director.update(makeFlow('roundIntro'), 200); // 200ms 경과
      expect(director.getScreenState().roundIntroRemainingTime).toBe(ROUND_INTRO_DURATION - 200);
    });

    it('roundIntroRemainingTime 은 0 미만으로 내려가지 않는다', () => {
      const director = new ScreenDirector(ROUND_INTRO_DURATION);
      director.update(makeFlow('roundIntro'), 0);
      director.update(makeFlow('roundIntro'), 9999);
      expect(director.getScreenState().roundIntroRemainingTime).toBe(0);
    });

    it('title 상태에서는 타이머가 감소하지 않는다', () => {
      const director = new ScreenDirector(ROUND_INTRO_DURATION);
      director.update(makeFlow('title'), 500);
      // roundIntro 진입 후 즉시 확인 (진입 틱에서 deltaMs=0 이면 타이머 감소 없음)
      director.update(makeFlow('roundIntro'), 0);
      expect(director.getScreenState().roundIntroRemainingTime).toBe(ROUND_INTRO_DURATION);
    });

    it('roundIntro 에서 inGame 으로 이동 후 다시 roundIntro 로 돌아오면 타이머가 리셋된다', () => {
      const director = new ScreenDirector(ROUND_INTRO_DURATION);
      director.update(makeFlow('roundIntro'), 0);
      director.update(makeFlow('roundIntro'), 700);
      expect(director.getScreenState().roundIntroRemainingTime).toBe(800);

      // inGame 전환
      director.update(makeFlow('inGame'), 0);
      // 다시 roundIntro
      director.update(makeFlow('roundIntro'), 0);
      expect(director.getScreenState().roundIntroRemainingTime).toBe(ROUND_INTRO_DURATION);
    });
  });

  describe('blockHitFlashBlockIds / isBarBreaking 초기값', () => {
    it('blockHitFlashBlockIds 는 빈 배열이다', () => {
      const director = new ScreenDirector(ROUND_INTRO_DURATION);
      expect(director.getScreenState().blockHitFlashBlockIds).toEqual([]);
    });

    it('isBarBreaking 은 false 이다', () => {
      const director = new ScreenDirector(ROUND_INTRO_DURATION);
      expect(director.getScreenState().isBarBreaking).toBe(false);
    });
  });
});
