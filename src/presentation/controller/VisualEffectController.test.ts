import { describe, it, expect, vi } from 'vitest';
import { VisualEffectController } from './VisualEffectController';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
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
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    expect(ctrl.getFlashingBlockIds()).toContain('b1');
  });

  it('update(10ms) 후 타이머가 감소하지만 아직 남아있음', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    ctrl.update(10, noOp);
    expect(ctrl.getFlashingBlockIds()).toContain('b1');
  });

  it('update(120ms) — flash duration 전부 소모 시 flashingBlocks 에서 제거됨', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    ctrl.update(120, noOp);
    expect(ctrl.getFlashingBlockIds()).not.toContain('b1');
  });

  it('update(150ms) — flash duration 초과 시에도 flashingBlocks 에서 제거됨', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    ctrl.update(150, noOp);
    expect(ctrl.getFlashingBlockIds()).not.toContain('b1');
  });

  it('여러 블록 BlockHit 후 각각 독립적으로 타이머 관리', () => {
    const ctrl = new VisualEffectController(config);
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
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'BlockHit', blockId: 'b1', remainingHits: 1 });
    expect(ctrl.getFlashingBlockIds()).toContain('b1');
    ctrl.handleGameplayEvent({ type: 'BlockDestroyed', blockId: 'b1', scoreDelta: 100 });
    expect(ctrl.getFlashingBlockIds()).not.toContain('b1');
  });
});

describe('VisualEffectController — 바 파괴 타이머', () => {
  it('LifeLost 수신 시 isBarBreaking() = true', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    expect(ctrl.isBarBreaking()).toBe(true);
  });

  it('초기 상태에서 isBarBreaking() = false', () => {
    const ctrl = new VisualEffectController(config);
    expect(ctrl.isBarBreaking()).toBe(false);
  });

  it('update(700ms) — barBreakDurationMs 소모 시 isBarBreaking = false', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    ctrl.update(700, noOp);
    expect(ctrl.isBarBreaking()).toBe(false);
  });

  it('update(700ms) 시 LifeLostPresentationFinished 1회 발행', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    const emitted: PresentationEvent[] = [];
    ctrl.update(700, (e) => emitted.push(e));
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.type).toBe('LifeLostPresentationFinished');
  });

  it('700ms 이후 추가 update(100ms) 에서 LifeLostPresentationFinished 추가 발행 없음', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    const emitted: PresentationEvent[] = [];
    const emit = (e: PresentationEvent): void => { emitted.push(e); };
    ctrl.update(700, emit);
    ctrl.update(100, emit);
    expect(emitted).toHaveLength(1);
  });

  it('update(300ms) — 아직 barBreakDurationMs 미완료 시 이벤트 발행 없음', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    const emitted: PresentationEvent[] = [];
    ctrl.update(300, (e) => emitted.push(e));
    expect(emitted).toHaveLength(0);
    expect(ctrl.isBarBreaking()).toBe(true);
  });
});

describe('VisualEffectController — getBarBreakProgress', () => {
  it('LifeLost 직후 progress = 1.0', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    expect(ctrl.getBarBreakProgress()).toBeCloseTo(1.0);
  });

  it('350ms 경과 후 progress ≈ 0.5', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    ctrl.update(350, noOp);
    expect(ctrl.getBarBreakProgress()).toBeCloseTo(0.5, 1);
  });

  it('700ms 경과 후 progress = 0.0', () => {
    const ctrl = new VisualEffectController(config);
    ctrl.handleGameplayEvent({ type: 'LifeLost', remainingLives: 2 });
    ctrl.update(700, noOp);
    expect(ctrl.getBarBreakProgress()).toBe(0);
  });
});
