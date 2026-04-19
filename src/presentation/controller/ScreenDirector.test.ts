import { describe, it, expect, vi } from 'vitest';
import { ScreenDirector } from './ScreenDirector';
import { VisualEffectController } from './VisualEffectController';
import type { GameFlowState } from '../../flow/state/GameFlowState';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { IntroSequenceEntry } from '../../definitions/types/IntroSequenceEntry';
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
  return new ScreenDirector(ROUND_INTRO_DURATION, new VisualEffectController(config, []));
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
      const vfx = new VisualEffectController(config, []);
      const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

      vfx.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
      director.update(makeFlow('inGame'), 10, noEmit);

      expect(director.getScreenState().blockHitFlashBlockIds).toContain('b1');
    });

    it('플래시 타이머 만료 후 blockHitFlashBlockIds 에서 제거된다', () => {
      const vfx = new VisualEffectController(config, []);
      const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

      vfx.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
      director.update(makeFlow('inGame'), 200, noEmit); // 120ms 초과

      expect(director.getScreenState().blockHitFlashBlockIds).not.toContain('b1');
    });
  });

  describe('VisualEffectController 통합 — isBarBreaking 반영', () => {
    it('LifeLost 이벤트 후 update 시 isBarBreaking = true', () => {
      const vfx = new VisualEffectController(config, []);
      const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

      vfx.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
      director.update(makeFlow('inGame'), 10, noEmit);

      expect(director.getScreenState().isBarBreaking).toBe(true);
    });

    it('700ms 이후 isBarBreaking = false', () => {
      const vfx = new VisualEffectController(config, []);
      const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

      vfx.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
      director.update(makeFlow('inGame'), 700, noEmit);

      expect(director.getScreenState().isBarBreaking).toBe(false);
    });

    it('LifeLostPresentationFinished 가 emitPresentationEvent 콜백으로 전달된다', () => {
      const vfx = new VisualEffectController(config, []);
      const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

      vfx.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });

      const emitted: PresentationEvent[] = [];
      director.update(makeFlow('inGame'), 700, (e) => emitted.push(e));

      expect(emitted).toHaveLength(1);
      expect(emitted[0]?.type).toBe('LifeLostPresentationFinished');
    });
  });
});

// ────────────────────────────────────────────────────────────
//  ScreenDirector — introStory 진입 / Intro 상태 반영 테스트
// ────────────────────────────────────────────────────────────

/** 2페이지 짜리 IntroSequenceTable (VisualEffectController 테스트와 동일 설정) */
const introPages: IntroSequenceEntry[] = [
  {
    pageIndex: 0,
    text: 'AB',
    typingSpeedMs: 50,  // typing duration = 100ms
    holdDurationMs: 200,
    eraseSpeedMs: 25,   // erasing duration = 50ms
  },
  {
    pageIndex: 1,
    text: 'CDE',
    typingSpeedMs: 40,  // typing duration = 120ms
    holdDurationMs: 300,
    eraseSpeedMs: 20,   // erasing duration = 60ms
  },
];

function makeIntroDirector(): ScreenDirector {
  return new ScreenDirector(ROUND_INTRO_DURATION, new VisualEffectController(config, introPages));
}

describe('ScreenDirector — introStory 진입 시 startIntroSequence 호출', () => {
  it('introStory 에 처음 진입하면 VisualEffectController.startIntroSequence 가 호출된다 (spy)', () => {
    const vfx = new VisualEffectController(config, introPages);
    const startSpy = vi.spyOn(vfx, 'startIntroSequence');
    const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

    director.update(makeFlow('introStory'), 0, () => {});
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('introStory 에서 introStory 로 연속 update 시 startIntroSequence 는 1회만 호출된다', () => {
    const vfx = new VisualEffectController(config, introPages);
    const startSpy = vi.spyOn(vfx, 'startIntroSequence');
    const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

    director.update(makeFlow('introStory'), 0, () => {});
    director.update(makeFlow('introStory'), 16, () => {});
    director.update(makeFlow('introStory'), 16, () => {});
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('introStory → roundIntro → introStory 재진입 시 startIntroSequence 2회 호출', () => {
    const vfx = new VisualEffectController(config, introPages);
    const startSpy = vi.spyOn(vfx, 'startIntroSequence');
    const director = new ScreenDirector(ROUND_INTRO_DURATION, vfx);

    director.update(makeFlow('introStory'), 0, () => {});
    director.update(makeFlow('roundIntro'), 0, () => {});
    director.update(makeFlow('introStory'), 0, () => {});
    expect(startSpy).toHaveBeenCalledTimes(2);
  });
});

describe('ScreenDirector — ScreenState 에 intro 필드 반영', () => {
  it('introStory 진입 첫 update 후 introPageIndex = 0, introPhase = typing', () => {
    const director = makeIntroDirector();
    director.update(makeFlow('introStory'), 0, () => {});
    const state = director.getScreenState();
    expect(state.introPageIndex).toBe(0);
    expect(state.introPhase).toBe('typing');
  });

  it('typing 50ms 경과 후 introTypingProgress ≈ 0.5', () => {
    const director = makeIntroDirector();
    director.update(makeFlow('introStory'), 0, () => {});   // 진입 (리셋)
    director.update(makeFlow('introStory'), 50, () => {}); // 50ms 경과
    expect(director.getScreenState().introTypingProgress).toBeCloseTo(0.5);
  });

  it('typing 완료(100ms) 후 introPhase = hold', () => {
    const director = makeIntroDirector();
    director.update(makeFlow('introStory'), 0, () => {});
    director.update(makeFlow('introStory'), 100, () => {});
    expect(director.getScreenState().introPhase).toBe('hold');
  });

  it('모든 페이지 진행 후 IntroSequenceFinished 가 emitPresentationEvent 를 통해 전달된다', () => {
    const director = makeIntroDirector();
    const emitted: PresentationEvent[] = [];
    const emit = (e: PresentationEvent): void => { emitted.push(e); };

    director.update(makeFlow('introStory'), 0, emit);   // 진입 (start)
    // page 0: typing 100ms
    director.update(makeFlow('introStory'), 100, emit);
    // page 0: hold 200ms
    director.update(makeFlow('introStory'), 200, emit);
    // page 0: erasing 50ms → page 1 진입
    director.update(makeFlow('introStory'), 50, emit);
    // page 1: typing 120ms
    director.update(makeFlow('introStory'), 120, emit);
    // page 1: hold 300ms
    director.update(makeFlow('introStory'), 300, emit);
    // page 1: erasing 60ms → done + IntroSequenceFinished
    director.update(makeFlow('introStory'), 60, emit);

    expect(emitted.some((e) => e.type === 'IntroSequenceFinished')).toBe(true);
  });
});
