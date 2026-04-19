import { describe, it, expect } from 'vitest';
import { HUDPresenter } from './HUDPresenter';
import type { GameSessionState } from '../../gameplay/state/GameSessionState';

function makeSession(overrides: Partial<GameSessionState> = {}): GameSessionState {
  return {
    currentStageIndex: 0,
    score: 0,
    lives: 3,
    highScore: 0,
    ...overrides,
  };
}

describe('HUDPresenter', () => {
  const presenter = new HUDPresenter();

  it('score 를 session.score 에서 매핑한다', () => {
    const vm = presenter.buildHudViewModel(makeSession({ score: 500 }));
    expect(vm.score).toBe(500);
  });

  it('lives 를 session.lives 에서 매핑한다', () => {
    const vm = presenter.buildHudViewModel(makeSession({ lives: 2 }));
    expect(vm.lives).toBe(2);
  });

  it('round 는 currentStageIndex + 1 이다', () => {
    const vm = presenter.buildHudViewModel(makeSession({ currentStageIndex: 0 }));
    expect(vm.round).toBe(1);
  });

  it('currentStageIndex 가 2 이면 round 는 3 이다', () => {
    const vm = presenter.buildHudViewModel(makeSession({ currentStageIndex: 2 }));
    expect(vm.round).toBe(3);
  });
});
