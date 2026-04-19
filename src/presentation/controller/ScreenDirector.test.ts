import { describe, it, expect, vi } from 'vitest';
import { ScreenDirector } from './ScreenDirector';
import { VisualEffectController } from './VisualEffectController';
import type { GameFlowState } from '../../flow/state/GameFlowState';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { PresentationEvent } from '../events/presentationEvents';

const ROUND_INTRO_DURATION = 1500;

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

function makeFlow(kind: GameFlowState['kind']): Readonly<GameFlowState> {
  return { kind, currentStageIndex: 0 };
}

function makeDirector(): ScreenDirector {
  return new ScreenDirector(ROUND_INTRO_DURATION, new VisualEffectController(config));
}

const noEmit = (_e: PresentationEvent): void => {};

describe('ScreenDirector', () => {
  describe('currentScreen 동기화', () => {
    it('flowState.kind === title 이면 currentScreen = title', () => {
      const director = makeDirector();
      director.update(makeFlow('title'), 16, noEmit);
      expect(director.getScreenState().currentScreen).toBe('title');
    });

    it('flowState.kind === inGame 이면 currentScreen = inGame', () => {
      const director = makeDirector();
      director.update(makeFlow('inGame'), 16, noEmit);
      expect(director.getScreenState().currentScreen).toBe('inGame');
    });

    it('flowState.kind === gameOver 이면 currentScreen = gameOver', () => {
      const director = makeDirector();
      director.update(makeFlow('gameOver'), 16, noEmit);
      expect(director.getScreenState().currentScreen).toBe('gameOver');
    });
  });

  describe('roundIntroRemainingTime', () => {
    it('roundIntro 진입 시 roundIntroRemainingTime = roundIntroDurationMs 로 리셋된다', () => {
      const director = makeDirector();
      // inGame 상태로 이동 후
      director.update(makeFlow('inGame'), 100, noEmit);
      // roundIntro 로 진입
      director.update(makeFlow('roundIntro'), 0, noEmit);
      expect(director.getScreenState().roundIntroRemainingTime).toBe(ROUND_INTRO_DURATION);
    });

    it('roundIntro 중 deltaMs 만큼 감소한다', () => {
      const director = makeDirector();
      director.update(makeFlow('roundIntro'), 0, noEmit);   // 진입 (리셋)
      director.update(makeFlow('roundIntro'), 200, noEmit); // 200ms 경과
      expect(director.getScreenState().roundIntroRemainingTime).toBe(ROUND_INTRO_DURATION - 200);
    });

    it('roundIntroRemainingTime 은 0 미만으로 내려가지 않는다', () => {
      const director = makeDirector();
      director.update(makeFlow('roundIntro'), 0, noEmit);
      director.update(makeFlow('roundIntro'), 9999, noEmit);
      expect(director.getScreenState().roundIntroRemainingTime).toBe(0);
    });

    it('title 상태에서는 타이머가 감소하지 않는다', () => {
      const director = makeDirector();
      director.update(makeFlow('title'), 500, noEmit);
      // roundIntro 진입 후 즉시 확인 (진입 틱에서 deltaMs=0 이면 타이머 감소 없음)
      director.update(makeFlow('roundIntro'), 0, noEmit);
      expect(director.getScreenState().roundIntroRemainingTime).toBe(ROUND_INTRO_DURATION);
    });

    it('roundIntro 에서 inGame 으로 이동 후 다시 roundIntro 로 돌아오면 타이머가 리셋된다', () => {
      const director = makeDirector();
      director.update(makeFlow('roundIntro'), 0, noEmit);
      director.update(makeFlow('roundIntro'), 700, noEmit);
      expect(director.getScreenState().roundIntroRemainingTime).toBe(800);

      // inGame 전환
      director.update(makeFlow('inGame'), 0, noEmit);
      // 다시 roundIntro
      director.update(makeFlow('roundIntro'), 0, noEmit);
      expect(director.getScreenState().roundIntroRemainingTime).toBe(ROUND_INTRO_DURATION);
    });
  });

  describe('blockHitFlashBlockIds / isBarBreaking 초기값', () => {
    it('blockHitFlashBlockIds 는 빈 배열이다', () => {
      const director = makeDirector();
      expect(director.getScreenState().blockHitFlashBlockIds).toEqual([]);
    });

    it('isBarBreaking 은 false 이다', () => {
      const director = makeDirector();
      expect(director.getScreenState().isBarBreaking).toBe(false);
    });
  });

  describe('VisualEffectController 통합 — blockHitFlashBlockIds 반영', () => {
    it('BlockHit 이벤트 후 update 시 blockHitFlashBlockIds 에 blockId 가 포함된다', () => {
      const vfx = new VisualEffectController(config);
      const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

      vfx.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
      director.update(makeFlow('inGame'), 10, noEmit);

      expect(director.getScreenState().blockHitFlashBlockIds).toContain('b1');
    });

    it('플래시 타이머 만료 후 blockHitFlashBlockIds 에서 제거된다', () => {
      const vfx = new VisualEffectController(config);
      const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

      vfx.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
      director.update(makeFlow('inGame'), 200, noEmit); // 120ms 초과

      expect(director.getScreenState().blockHitFlashBlockIds).not.toContain('b1');
    });
  });

  describe('VisualEffectController 통합 — isBarBreaking 반영', () => {
    it('LifeLost 이벤트 후 update 시 isBarBreaking = true', () => {
      const vfx = new VisualEffectController(config);
      const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

      vfx.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
      director.update(makeFlow('inGame'), 10, noEmit);

      expect(director.getScreenState().isBarBreaking).toBe(true);
    });

    it('700ms 이후 isBarBreaking = false', () => {
      const vfx = new VisualEffectController(config);
      const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

      vfx.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
      director.update(makeFlow('inGame'), 700, noEmit);

      expect(director.getScreenState().isBarBreaking).toBe(false);
    });

    it('LifeLostPresentationFinished 가 emitPresentationEvent 콜백으로 전달된다', () => {
      const vfx = new VisualEffectController(config);
      const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

      vfx.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });

      const emitted: PresentationEvent[] = [];
      director.update(makeFlow('inGame'), 700, (e) => emitted.push(e));

      expect(emitted).toHaveLength(1);
      expect(emitted[0]?.type).toBe('LifeLostPresentationFinished');
    });
  });
});
