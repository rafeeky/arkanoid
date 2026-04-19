import { describe, it, expect } from 'vitest';
import { VisualEffectController } from './VisualEffectController';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { IntroSequenceEntry } from '../../definitions/types/IntroSequenceEntry';
import type { PresentationEvent } from '../events/presentationEvents';

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

const noOp = (_e: PresentationEvent): void => {};

describe('VisualEffectController — BlockHit 플래시', () => {
  it('BlockHit 수신 시 flashingBlocks 에 blockId 추가됨', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    expect(ctrl.getFlashingBlockIds()).toContain('b1');
  });

  it('update(10ms) 후 타이머가 감소하지만 아직 남아있음', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    ctrl.update(10, noOp);
    expect(ctrl.getFlashingBlockIds()).toContain('b1');
  });

  it('update(120ms) — flash duration 전부 소모 시 flashingBlocks 에서 제거됨', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    ctrl.update(120, noOp);
    expect(ctrl.getFlashingBlockIds()).not.toContain('b1');
  });

  it('update(150ms) — flash duration 초과 시에도 flashingBlocks 에서 제거됨', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    ctrl.update(150, noOp);
    expect(ctrl.getFlashingBlockIds()).not.toContain('b1');
  });

  it('여러 블록 BlockHit 후 각각 독립적으로 타이머 관리', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b2', remainingHits: 2 });
    ctrl.update(10, noOp);
    expect(ctrl.getFlashingBlockIds()).toContain('b1');
    expect(ctrl.getFlashingBlockIds()).toContain('b2');
    ctrl.update(120, noOp);
    expect(ctrl.getFlashingBlockIds()).not.toContain('b1');
    expect(ctrl.getFlashingBlockIds()).not.toContain('b2');
  });
});

describe('VisualEffectController — BlockDestroyed', () => {
  it('BlockHit 후 BlockDestroyed 수신 시 flashingBlocks 에서 즉시 제거됨', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    expect(ctrl.getFlashingBlockIds()).toContain('b1');
    ctrl.handleGameplayEvent({ type: 'BlockDestroyed', blockId: 'b1', scoreDelta: 100 });
    expect(ctrl.getFlashingBlockIds()).not.toContain('b1');
  });
});

describe('VisualEffectController — 바 파괴 타이머', () => {
  it('LifeLost 수신 시 isBarBreaking() = true', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    expect(ctrl.isBarBreaking()).toBe(true);
  });

  it('초기 상태에서 isBarBreaking() = false', () => {
    const ctrl = new VisualEffectController(config, []);
    expect(ctrl.isBarBreaking()).toBe(false);
  });

  it('update(700ms) — barBreakDurationMs 소모 시 isBarBreaking = false', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    ctrl.update(700, noOp);
    expect(ctrl.isBarBreaking()).toBe(false);
  });

  it('update(700ms) 시 LifeLostPresentationFinished 1회 발행', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    const emitted: PresentationEvent[] = [];
    ctrl.update(700, (e) => emitted.push(e));
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.type).toBe('LifeLostPresentationFinished');
  });

  it('700ms 이후 추가 update(100ms) 에서 LifeLostPresentationFinished 추가 발행 없음', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    const emitted: PresentationEvent[] = [];
    const emit = (e: PresentationEvent): void => { emitted.push(e); };
    ctrl.update(700, emit);
    ctrl.update(100, emit);
    expect(emitted).toHaveLength(1);
  });

  it('update(300ms) — 아직 barBreakDurationMs 미완료 시 이벤트 발행 없음', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    const emitted: PresentationEvent[] = [];
    ctrl.update(300, (e) => emitted.push(e));
    expect(emitted).toHaveLength(0);
    expect(ctrl.isBarBreaking()).toBe(true);
  });
});

describe('VisualEffectController — getBarBreakProgress', () => {
  it('LifeLost 직후 progress = 1.0', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    expect(ctrl.getBarBreakProgress()).toBeCloseTo(1.0);
  });

  it('350ms 경과 후 progress ≈ 0.5', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    ctrl.update(350, noOp);
    expect(ctrl.getBarBreakProgress()).toBeCloseTo(0.5, 1);
  });

  it('700ms 경과 후 progress = 0.0', () => {
    const ctrl = new VisualEffectController(config, []);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    ctrl.update(700, noOp);
    expect(ctrl.getBarBreakProgress()).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
//  Intro 시퀀스 테스트
// ────────────────────────────────────────────────────────────

/** 2페이지 짜리 짧은 IntroSequenceTable (타이밍 계산 쉽도록 짧은 텍스트) */
const introPages: IntroSequenceEntry[] = [
  {
    pageIndex: 0,
    text: 'AB',       // 2글자
    typingSpeedMs: 50,  // typing duration = 100ms
    holdDurationMs: 200,
    eraseSpeedMs: 25,   // erasing duration = 50ms
  },
  {
    pageIndex: 1,
    text: 'CDE',      // 3글자
    typingSpeedMs: 40,  // typing duration = 120ms
    holdDurationMs: 300,
    eraseSpeedMs: 20,   // erasing duration = 60ms
  },
];

function makeIntroCtrl(): VisualEffectController {
  return new VisualEffectController(config, introPages);
}

describe('VisualEffectController — Intro 시퀀스: startIntroSequence 초기화', () => {
  it('startIntroSequence 호출 후 pageIndex = 0, phase = typing, progress = 0', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    expect(ctrl.getIntroPageIndex()).toBe(0);
    expect(ctrl.getIntroPhase()).toBe('typing');
    expect(ctrl.getIntroTypingProgress()).toBe(0);
  });

  it('startIntroSequence 를 호출하지 않으면 progress = 0, phase = typing (초기값)', () => {
    const ctrl = makeIntroCtrl();
    // introActive === false 상태에서는 0 반환
    expect(ctrl.getIntroTypingProgress()).toBe(0);
  });
});

describe('VisualEffectController — Intro 시퀀스: typing phase', () => {
  it('typing 시작 직후 progress = 0', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    // update(0) 호출 — 시간 경과 없음
    ctrl.update(0, noOp);
    expect(ctrl.getIntroTypingProgress()).toBe(0);
    expect(ctrl.getIntroPhase()).toBe('typing');
  });

  it('typing 중간(50ms): progress ≈ 0.5 (duration=100ms)', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    ctrl.update(50, noOp);
    expect(ctrl.getIntroTypingProgress()).toBeCloseTo(0.5);
    expect(ctrl.getIntroPhase()).toBe('typing');
  });

  it('typing 100ms 경과 시 phase = hold 로 전환', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    ctrl.update(100, noOp);
    expect(ctrl.getIntroPhase()).toBe('hold');
    expect(ctrl.getIntroTypingProgress()).toBe(1); // hold 중에는 항상 1
  });
});

describe('VisualEffectController — Intro 시퀀스: hold phase', () => {
  it('hold 중 progress = 1', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    ctrl.update(100, noOp); // typing 완료 → hold
    expect(ctrl.getIntroPhase()).toBe('hold');
    ctrl.update(100, noOp); // hold 중 (아직 200ms 미만)
    expect(ctrl.getIntroTypingProgress()).toBe(1);
  });

  it('hold 200ms 경과 시 phase = erasing 으로 전환', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    ctrl.update(100, noOp); // typing → hold
    ctrl.update(200, noOp); // hold 200ms 소진 → erasing
    expect(ctrl.getIntroPhase()).toBe('erasing');
  });
});

describe('VisualEffectController — Intro 시퀀스: erasing phase', () => {
  it('erasing 시작 직후 progress ≈ 1 (아직 elapsed=0)', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    ctrl.update(100, noOp); // typing → hold
    ctrl.update(200, noOp); // hold → erasing (elapsed=0)
    expect(ctrl.getIntroPhase()).toBe('erasing');
    expect(ctrl.getIntroTypingProgress()).toBeCloseTo(1);
  });

  it('erasing 중간(25ms): progress ≈ 0.5 (eraseDuration=50ms)', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    ctrl.update(100, noOp); // typing → hold
    ctrl.update(200, noOp); // hold → erasing
    ctrl.update(25, noOp);  // erasing 25ms 경과
    expect(ctrl.getIntroTypingProgress()).toBeCloseTo(0.5);
  });

  it('erasing 50ms 후 pageIndex 0 → 1 로 전환, phase = typing', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    ctrl.update(100, noOp); // typing(p0) → hold
    ctrl.update(200, noOp); // hold → erasing
    ctrl.update(50, noOp);  // erasing 완료 → page 1
    expect(ctrl.getIntroPageIndex()).toBe(1);
    expect(ctrl.getIntroPhase()).toBe('typing');
  });
});

describe('VisualEffectController — Intro 시퀀스: 마지막 페이지 완료', () => {
  /**
   * 페이지 1(index 1)을 모두 진행하는 헬퍼.
   * 전제: ctrl 은 이미 page 1 typing 시작 상태.
   */
  function finishPage1(ctrl: VisualEffectController, emit: (e: PresentationEvent) => void): void {
    ctrl.update(120, emit); // typing 120ms → hold
    ctrl.update(300, emit); // hold 300ms → erasing
    ctrl.update(60, emit);  // erasing 60ms → done
  }

  it('마지막 페이지 erasing 종료 시 IntroSequenceFinished 발행', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    // page 0 진행
    ctrl.update(100, noOp);
    ctrl.update(200, noOp);
    ctrl.update(50, noOp); // → page 1

    const emitted: PresentationEvent[] = [];
    const emit = (e: PresentationEvent): void => { emitted.push(e); };
    finishPage1(ctrl, emit);

    expect(emitted.some((e) => e.type === 'IntroSequenceFinished')).toBe(true);
    expect(ctrl.getIntroPhase()).toBe('done');
  });

  it('IntroSequenceFinished 는 정확히 1회만 발행 (guard 동작)', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    // page 0
    ctrl.update(100, noOp);
    ctrl.update(200, noOp);
    ctrl.update(50, noOp); // → page 1

    const emitted: PresentationEvent[] = [];
    const emit = (e: PresentationEvent): void => { emitted.push(e); };
    finishPage1(ctrl, emit);

    // 추가 틱 — 재발행 없어야 함
    ctrl.update(100, emit);
    ctrl.update(100, emit);

    const finishCount = emitted.filter((e) => e.type === 'IntroSequenceFinished').length;
    expect(finishCount).toBe(1);
  });

  it('done 상태에서 progress = 0', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    ctrl.update(100, noOp);
    ctrl.update(200, noOp);
    ctrl.update(50, noOp);
    finishPage1(ctrl, noOp);
    expect(ctrl.getIntroTypingProgress()).toBe(0);
  });
});

describe('VisualEffectController — Intro 시퀀스: progress 경계값', () => {
  it('typing phase: progress 는 1 을 초과하지 않는다', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    ctrl.update(9999, noOp); // 아주 긴 틱 — typing 이 hold 로 전환되어도
    // hold 또는 이후 단계일 수 있으나 progress 가 1 이하여야 함
    expect(ctrl.getIntroTypingProgress()).toBeLessThanOrEqual(1);
  });

  it('erasing phase: progress 는 0 미만으로 내려가지 않는다', () => {
    const ctrl = makeIntroCtrl();
    ctrl.startIntroSequence();
    ctrl.update(100, noOp); // typing → hold
    ctrl.update(200, noOp); // hold → erasing
    ctrl.update(9999, noOp); // erasing 과잉 소진
    expect(ctrl.getIntroTypingProgress()).toBeGreaterThanOrEqual(0);
  });
});
