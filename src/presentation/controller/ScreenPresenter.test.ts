import { describe, it, expect } from 'vitest';
import { ScreenPresenter } from './ScreenPresenter';
import type { GameSessionState } from '../../gameplay/state/GameSessionState';
import type { UITextEntry } from '../../definitions/types/UITextEntry';
import type { IntroSequenceEntry } from '../../definitions/types/IntroSequenceEntry';

const uiTexts: UITextEntry[] = [
  { textId: 'txt_title_start', value: 'PRESS SPACE TO START' },
  { textId: 'txt_title_highscore', value: 'HIGH SCORE {0}' },
  { textId: 'txt_round_01', value: 'ROUND 1' },
  { textId: 'txt_round_02', value: 'ROUND 2' },
  { textId: 'txt_round_03', value: 'ROUND 3' },
  { textId: 'txt_ready', value: 'READY' },
  { textId: 'txt_gameover', value: 'GAME OVER' },
  { textId: 'txt_retry', value: 'PRESS SPACE TO RETRY' },
  { textId: 'txt_gameover_final_score', value: 'FINAL SCORE {0}' },
  { textId: 'txt_gameclear', value: 'CONGRATULATIONS' },
  { textId: 'txt_gameclear_final_score', value: 'FINAL SCORE {0}' },
  { textId: 'txt_gameclear_retry', value: 'PRESS SPACE TO RETRY' },
];

const introPages: IntroSequenceEntry[] = [
  { pageIndex: 0, text: 'ABCDE', typingSpeedMs: 40, holdDurationMs: 1000, eraseSpeedMs: 20 },
  { pageIndex: 1, text: 'FGHIJ', typingSpeedMs: 40, holdDurationMs: 1000, eraseSpeedMs: 20 },
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
    it('stageIndex=0 이면 ROUND 1 반환', () => {
      const vm = presenter.buildRoundIntroViewModel(makeSession({ currentStageIndex: 0 }), uiTexts);
      expect(vm.roundLabel).toBe('ROUND 1');
    });

    it('stageIndex=1 이면 ROUND 2 반환', () => {
      const vm = presenter.buildRoundIntroViewModel(makeSession({ currentStageIndex: 1 }), uiTexts);
      expect(vm.roundLabel).toBe('ROUND 2');
    });

    it('stageIndex=2 이면 ROUND 3 반환', () => {
      const vm = presenter.buildRoundIntroViewModel(makeSession({ currentStageIndex: 2 }), uiTexts);
      expect(vm.roundLabel).toBe('ROUND 3');
    });

    it('readyLabel 을 반환한다', () => {
      const vm = presenter.buildRoundIntroViewModel(makeSession(), uiTexts);
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
    it('finalScoreLabel 에 점수가 치환된다', () => {
      const session = makeSession({ score: 1234 });
      const vm = presenter.buildGameOverViewModel(session, uiTexts);
      expect(vm.finalScoreLabel).toBe('FINAL SCORE 1234');
    });

    it('highScoreLabel 에 highScore 가 치환된다', () => {
      const session = makeSession({ score: 100, highScore: 9999 });
      const vm = presenter.buildGameOverViewModel(session, uiTexts);
      expect(vm.highScoreLabel).toBe('HIGH SCORE 9999');
    });

    it('gameOverLabel 과 retryText 는 UITextTable 에서 조회한다', () => {
      const vm = presenter.buildGameOverViewModel(makeSession(), uiTexts);
      expect(vm.gameOverLabel).toBe('GAME OVER');
      expect(vm.retryText).toBe('PRESS SPACE TO RETRY');
    });

    it('isNewHighScore: score > 0 && score >= highScore 이면 true', () => {
      const session = makeSession({ score: 500, highScore: 500 });
      const vm = presenter.buildGameOverViewModel(session, uiTexts);
      expect(vm.isNewHighScore).toBe(true);
    });

    it('isNewHighScore: score > 0 && score > highScore 이면 true (신규 갱신)', () => {
      const session = makeSession({ score: 1200, highScore: 1000 });
      const vm = presenter.buildGameOverViewModel(session, uiTexts);
      expect(vm.isNewHighScore).toBe(true);
    });

    it('isNewHighScore: score = 0 이면 false', () => {
      const session = makeSession({ score: 0, highScore: 0 });
      const vm = presenter.buildGameOverViewModel(session, uiTexts);
      expect(vm.isNewHighScore).toBe(false);
    });

    it('isNewHighScore: score < highScore 이면 false', () => {
      const session = makeSession({ score: 300, highScore: 500 });
      const vm = presenter.buildGameOverViewModel(session, uiTexts);
      expect(vm.isNewHighScore).toBe(false);
    });

    it('일반 기록: highScoreLabel 색상 판단을 위해 isNewHighScore=false', () => {
      const session = makeSession({ score: 200, highScore: 500 });
      const vm = presenter.buildGameOverViewModel(session, uiTexts);
      expect(vm.isNewHighScore).toBe(false);
      expect(vm.highScoreLabel).toBe('HIGH SCORE 500');
      expect(vm.finalScoreLabel).toBe('FINAL SCORE 200');
    });
  });

  describe('buildIntroScreenViewModel', () => {
    it('phase=done 이면 isVisible=false, visibleText=""', () => {
      const vm = presenter.buildIntroScreenViewModel(0, 0, 'done', introPages);
      expect(vm.isVisible).toBe(false);
      expect(vm.visibleText).toBe('');
    });

    it('phase=typing, progress=0.0 이면 visibleText=""', () => {
      const vm = presenter.buildIntroScreenViewModel(0, 0.0, 'typing', introPages);
      expect(vm.visibleText).toBe('');
      expect(vm.isVisible).toBe(true);
    });

    it('phase=typing, progress=0.6 이면 text 앞 60% 슬라이스', () => {
      // 'ABCDE' 5글자 * 0.6 = 3글자 → 'ABC'
      const vm = presenter.buildIntroScreenViewModel(0, 0.6, 'typing', introPages);
      expect(vm.visibleText).toBe('ABC');
      expect(vm.isVisible).toBe(true);
    });

    it('phase=typing, progress=1.0 이면 전체 text', () => {
      const vm = presenter.buildIntroScreenViewModel(0, 1.0, 'typing', introPages);
      expect(vm.visibleText).toBe('ABCDE');
      expect(vm.isVisible).toBe(true);
    });

    it('phase=hold 이면 항상 전체 text', () => {
      const vm = presenter.buildIntroScreenViewModel(0, 0.5, 'hold', introPages);
      expect(vm.visibleText).toBe('ABCDE');
      expect(vm.isVisible).toBe(true);
    });

    it('phase=erasing, progress=1.0 이면 전체 text (아직 지우기 전)', () => {
      const vm = presenter.buildIntroScreenViewModel(0, 1.0, 'erasing', introPages);
      expect(vm.visibleText).toBe('ABCDE');
      expect(vm.isVisible).toBe(true);
    });

    it('phase=erasing, progress=0.4 이면 text 앞 40% 슬라이스', () => {
      // 'ABCDE' 5글자 * 0.4 = 2글자 → 'AB'
      const vm = presenter.buildIntroScreenViewModel(0, 0.4, 'erasing', introPages);
      expect(vm.visibleText).toBe('AB');
      expect(vm.isVisible).toBe(true);
    });

    it('phase=erasing, progress=0.0 이면 visibleText=""', () => {
      const vm = presenter.buildIntroScreenViewModel(0, 0.0, 'erasing', introPages);
      expect(vm.visibleText).toBe('');
      expect(vm.isVisible).toBe(true);
    });

    it('pageIndex=1 이면 두 번째 페이지 text 사용', () => {
      const vm = presenter.buildIntroScreenViewModel(1, 1.0, 'hold', introPages);
      expect(vm.visibleText).toBe('FGHIJ');
    });

    it('pageIndex 범위 밖이면 isVisible=false', () => {
      const vm = presenter.buildIntroScreenViewModel(99, 1.0, 'typing', introPages);
      expect(vm.isVisible).toBe(false);
    });
  });

  describe('buildGameClearViewModel', () => {
    it('headline 은 txt_gameclear 에서 조회한다', () => {
      const vm = presenter.buildGameClearViewModel(makeSession(), uiTexts);
      expect(vm.headline).toBe('CONGRATULATIONS');
    });

    it('finalScoreLabel 에 점수가 치환된다', () => {
      const session = makeSession({ score: 4200 });
      const vm = presenter.buildGameClearViewModel(session, uiTexts);
      expect(vm.finalScoreLabel).toBe('FINAL SCORE 4200');
    });

    it('highScoreLabel 에 highScore 가 치환된다', () => {
      const session = makeSession({ score: 100, highScore: 9999 });
      const vm = presenter.buildGameClearViewModel(session, uiTexts);
      expect(vm.highScoreLabel).toBe('HIGH SCORE 9999');
    });

    it('retryText 는 txt_gameclear_retry 에서 조회한다', () => {
      const vm = presenter.buildGameClearViewModel(makeSession(), uiTexts);
      expect(vm.retryText).toBe('PRESS SPACE TO RETRY');
    });

    it('isNewHighScore: score > 0 && score >= highScore 이면 true', () => {
      const session = makeSession({ score: 1000, highScore: 1000 });
      const vm = presenter.buildGameClearViewModel(session, uiTexts);
      expect(vm.isNewHighScore).toBe(true);
    });

    it('isNewHighScore: score > 0 && score > highScore 이면 true', () => {
      const session = makeSession({ score: 1200, highScore: 1000 });
      const vm = presenter.buildGameClearViewModel(session, uiTexts);
      expect(vm.isNewHighScore).toBe(true);
    });

    it('isNewHighScore: score = 0 이면 false', () => {
      const session = makeSession({ score: 0, highScore: 0 });
      const vm = presenter.buildGameClearViewModel(session, uiTexts);
      expect(vm.isNewHighScore).toBe(false);
    });

    it('isNewHighScore: score < highScore 이면 false', () => {
      const session = makeSession({ score: 500, highScore: 1000 });
      const vm = presenter.buildGameClearViewModel(session, uiTexts);
      expect(vm.isNewHighScore).toBe(false);
    });
  });
});
