import { describe, it, expect } from 'vitest';
import { HUDPresenter } from './HUDPresenter';
import type { GameSessionState } from '../../gameplay/state/GameSessionState';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';
import type { BarState } from '../../gameplay/state/BarState';

function makeSession(overrides: Partial<GameSessionState> = {}): GameSessionState {
  return {
    currentStageIndex: 0,
    score: 0,
    lives: 3,
    highScore: 0,
    ...overrides,
  };
}

function makeBar(overrides: Partial<BarState> = {}): BarState {
  return {
    x: 360,
    y: 680,
    width: 120,
    moveSpeed: 400,
    activeEffect: 'none',
    ...overrides,
  };
}

function makeGameplayState(
  sessionOverrides: Partial<GameSessionState> = {},
  barOverrides: Partial<BarState> = {},
  extra: Partial<Pick<GameplayRuntimeState, 'magnetRemainingTime' | 'laserCooldownRemaining'>> = {},
): GameplayRuntimeState {
  return {
    session: makeSession(sessionOverrides),
    bar: makeBar(barOverrides),
    balls: [],
    blocks: [],
    itemDrops: [],
    isStageCleared: false,
    magnetRemainingTime: extra.magnetRemainingTime ?? 0,
    attachedBallIds: [],
    laserCooldownRemaining: extra.laserCooldownRemaining ?? 0,
    laserShots: [],
    spinnerStates: [],
  };
}

describe('HUDPresenter', () => {
  const presenter = new HUDPresenter();

  // ── 기존: GameSessionState 오버로드 ─────────────────────────────────────────

  it('score 를 session.score 에서 매핑한다 (session 오버로드)', () => {
    const vm = presenter.buildHudViewModel(makeSession({ score: 500 }));
    expect(vm.score).toBe(500);
  });

  it('lives 를 session.lives 에서 매핑한다 (session 오버로드)', () => {
    const vm = presenter.buildHudViewModel(makeSession({ lives: 2 }));
    expect(vm.lives).toBe(2);
  });

  it('round 는 currentStageIndex + 1 이다 (session 오버로드)', () => {
    const vm = presenter.buildHudViewModel(makeSession({ currentStageIndex: 0 }));
    expect(vm.round).toBe(1);
  });

  it('currentStageIndex 가 2 이면 round 는 3 이다 (session 오버로드)', () => {
    const vm = presenter.buildHudViewModel(makeSession({ currentStageIndex: 2 }));
    expect(vm.round).toBe(3);
  });

  // ── 신규: GameplayRuntimeState 오버로드 ────────────────────────────────────

  it('GameplayRuntimeState 오버로드: score/lives/round 가 올바르게 매핑된다', () => {
    const vm = presenter.buildHudViewModel(
      makeGameplayState({ score: 800, lives: 2, currentStageIndex: 1 }),
    );
    expect(vm.score).toBe(800);
    expect(vm.lives).toBe(2);
    expect(vm.round).toBe(2);
  });

  it('activeEffect none 상태에서 activeEffect 는 none 이고 magnetRemainingMs 는 0 이다', () => {
    const vm = presenter.buildHudViewModel(
      makeGameplayState({}, { activeEffect: 'none' }, { magnetRemainingTime: 0 }),
    );
    expect(vm.activeEffect).toBe('none');
    expect(vm.magnetRemainingMs).toBe(0);
  });

  it('magnet 효과 활성 시 activeEffect 는 magnet, magnetRemainingMs 가 올바르게 채워진다', () => {
    const vm = presenter.buildHudViewModel(
      makeGameplayState({}, { activeEffect: 'magnet' }, { magnetRemainingTime: 4200 }),
    );
    expect(vm.activeEffect).toBe('magnet');
    expect(vm.magnetRemainingMs).toBe(4200);
    expect(vm.laserCooldownMs).toBe(0);
  });

  it('laser 효과 활성 시 activeEffect 는 laser, laserCooldownMs 가 올바르게 채워진다', () => {
    const vm = presenter.buildHudViewModel(
      makeGameplayState({}, { activeEffect: 'laser' }, { laserCooldownRemaining: 1500 }),
    );
    expect(vm.activeEffect).toBe('laser');
    expect(vm.laserCooldownMs).toBe(1500);
    expect(vm.magnetRemainingMs).toBe(0);
  });

  it('expand 효과 활성 시 activeEffect 는 expand, magnetRemainingMs/laserCooldownMs 는 0 이다', () => {
    const vm = presenter.buildHudViewModel(
      makeGameplayState({}, { activeEffect: 'expand' }),
    );
    expect(vm.activeEffect).toBe('expand');
    expect(vm.magnetRemainingMs).toBe(0);
    expect(vm.laserCooldownMs).toBe(0);
  });

  it('session 오버로드는 activeEffect none, 나머지 효과 필드 0 을 반환한다', () => {
    const vm = presenter.buildHudViewModel(makeSession());
    expect(vm.activeEffect).toBe('none');
    expect(vm.magnetRemainingMs).toBe(0);
    expect(vm.laserCooldownMs).toBe(0);
  });
});
