import { describe, it, expect } from 'vitest';
import { ScreenPresenter } from './ScreenPresenter';
import type { GameSessionState } from '../../gameplay/state/GameSessionState';
import type { UITextEntry } from '../../definitions/types/UITextEntry';

const uiTexts: UITextEntry[] = [
  { textId: 'txt_title_start', value: 'PRESS SPACE TO START' },
  { textId: 'txt_title_highscore', value: 'HIGH SCORE {0}' },
  { textId: 'txt_round_01', value: 'ROUND 1' },
  { textId: 'txt_ready', value: 'READY' },
  { textId: 'txt_gameover', value: 'GAME OVER' },
  { textId: 'txt_retry', value: 'PRESS SPACE TO RETRY' },
];

function makeSession(overrides: Partial<GameSessionState> = {}): GameSessionState {
  return {
    currentStageIndex: 0,
    score: 0,
    lives: 3,
    highScore: 0,
    ...overrides,
  };
}

describe('ScreenPresenter', () => {
  const presenter = new ScreenPresenter();

  describe('buildTitleViewModel', () => {
    it('highScore를 session에서 주입한다', () => {
      const session = makeSession({ highScore: 9999 });
      const vm = presenter.buildTitleViewModel(session, uiTexts);
      expect(vm.highScore).toBe(9999);
    });

    it('startText는 UITextTable 에서 조회한다', () => {
      const session = makeSession();
      const vm = presenter.buildTitleViewModel(session, uiTexts);
      expect(vm.startText).toBe('PRESS SPACE TO START');
    });

    it('UIText가 없으면 textId를 그대로 반환한다', () => {
      const vm = presenter.buildTitleViewModel(makeSession(), []);
      expect(vm.startText).toBe('txt_title_start');
    });
  });

  describe('buildRoundIntroViewModel', () => {
    it('roundLabel 과 readyLabel 을 반환한다', () => {
      const vm = presenter.buildRoundIntroViewModel(makeSession(), uiTexts);
      expect(vm.roundLabel).toBe('ROUND 1');
      expect(vm.readyLabel).toBe('READY');
    });

    it('roundIntroRemainingTime = duration(1500) 이면 introProgress = 0.0 (시작)', () => {
      const vm = presenter.buildRoundIntroViewModel(makeSession(), uiTexts, 1500, 1500);
      expect(vm.introProgress).toBeCloseTo(0.0);
    });

    it('roundIntroRemainingTime = 750 이면 introProgress ≈ 0.5 (중간)', () => {
      const vm = presenter.buildRoundIntroViewModel(makeSession(), uiTexts, 750, 1500);
      expect(vm.introProgress).toBeCloseTo(0.5);
    });

    it('roundIntroRemainingTime = 0 이면 introProgress = 1.0 (종료)', () => {
      const vm = presenter.buildRoundIntroViewModel(makeSession(), uiTexts, 0, 1500);
      expect(vm.introProgress).toBeCloseTo(1.0);
    });
  });

  describe('buildGameOverViewModel', () => {
    it('finalScore 를 session.score 에서 주입한다', () => {
      const session = makeSession({ score: 1234 });
      const vm = presenter.buildGameOverViewModel(session, uiTexts);
      expect(vm.finalScore).toBe(1234);
    });

    it('gameOverLabel 과 retryText 는 UITextTable 에서 조회한다', () => {
      const vm = presenter.buildGameOverViewModel(makeSession(), uiTexts);
      expect(vm.gameOverLabel).toBe('GAME OVER');
      expect(vm.retryText).toBe('PRESS SPACE TO RETRY');
    });
  });
});
