import type { GameSessionState } from '../../gameplay/state/GameSessionState';
import type { UITextEntry } from '../../definitions/types/UITextEntry';
import type { IntroSequenceEntry } from '../../definitions/types/IntroSequenceEntry';
import type { IntroPhase } from '../state/ScreenState';
import type { TitleScreenViewModel } from '../view-models/TitleScreenViewModel';
import type { RoundIntroViewModel } from '../view-models/RoundIntroViewModel';
import type { GameOverViewModel } from '../view-models/GameOverViewModel';
import type { IntroScreenViewModel } from '../view-models/IntroScreenViewModel';
import type { GameClearViewModel } from '../view-models/GameClearViewModel';

/** stageIndex → UIText key 매핑 (0-based) */
const ROUND_TEXT_IDS = ['txt_round_01', 'txt_round_02', 'txt_round_03'] as const;

/**
 * ScreenPresenter — flowState + gameplayState → ViewModel 변환기.
 *
 * 규칙 계산/판단 금지. 읽기 전용 매퍼.
 * Unity 매핑: TitleScreenView, RoundIntroView, GameOverView, IntroStoryView, GameClearView에
 * 각각 대응되는 Binder 역할의 MonoBehaviour로 분리된다.
 */
export class ScreenPresenter {
  buildTitleViewModel(
    session: Readonly<GameSessionState>,
    uiTexts: readonly UITextEntry[],
  ): TitleScreenViewModel {
    const startText = this.lookupText(uiTexts, 'txt_title_start');
    return {
      startText,
      highScore: session.highScore,
    };
  }

  buildRoundIntroViewModel(
    session: Readonly<GameSessionState>,
    uiTexts: readonly UITextEntry[],
    roundIntroRemainingTime: number = 0,
    roundIntroDurationMs: number = 1500,
  ): RoundIntroViewModel {
    // stageIndex 0/1/2 → txt_round_01/02/03. 범위 밖이면 fallback으로 0.
    const roundTextId =
      ROUND_TEXT_IDS[session.currentStageIndex] ?? ROUND_TEXT_IDS[0];
    const roundLabel = this.lookupText(uiTexts, roundTextId);
    const readyLabel = this.lookupText(uiTexts, 'txt_ready');
    // introProgress: 0.0(시작) ~ 1.0(종료). 남은 시간이 줄어들수록 1에 가까워짐.
    const elapsed = roundIntroDurationMs - roundIntroRemainingTime;
    const introProgress =
      roundIntroDurationMs > 0
        ? Math.max(0, Math.min(1, elapsed / roundIntroDurationMs))
        : 1;
    return {
      roundLabel,
      readyLabel,
      introProgress,
    };
  }

  buildGameOverViewModel(
    session: Readonly<GameSessionState>,
    uiTexts: readonly UITextEntry[],
  ): GameOverViewModel {
    const gameOverLabel = this.lookupText(uiTexts, 'txt_gameover');
    const finalScoreTemplate = this.lookupText(uiTexts, 'txt_gameover_final_score');
    const highScoreTemplate = this.lookupText(uiTexts, 'txt_title_highscore');
    const retryText = this.lookupText(uiTexts, 'txt_retry');

    const finalScoreLabel = finalScoreTemplate.replace('{0}', String(session.score));
    const highScoreLabel = highScoreTemplate.replace('{0}', String(session.highScore));
    const isNewHighScore = session.score > 0 && session.score >= session.highScore;

    return {
      gameOverLabel,
      finalScoreLabel,
      highScoreLabel,
      retryText,
      isNewHighScore,
    };
  }

  /**
   * buildIntroScreenViewModel — ScreenState의 intro 진행 상태를 IntroScreenViewModel로 변환.
   *
   * phase에 따른 visibleText 계산:
   * - typing:  text.slice(0, Math.floor(progress * text.length))
   * - hold:    전체 text
   * - erasing: text.slice(0, Math.floor(progress * text.length)) (progress 1→0)
   * - done:    빈 문자열 + isVisible = false
   *
   * @param introPageIndex  현재 페이지 인덱스 (ScreenState.introPageIndex)
   * @param introTypingProgress  0~1 진행률 (ScreenState.introTypingProgress)
   * @param introPhase  현재 phase (ScreenState.introPhase)
   * @param introPages  IntroSequenceTable
   */
  buildIntroScreenViewModel(
    introPageIndex: number,
    introTypingProgress: number,
    introPhase: IntroPhase,
    introPages: readonly IntroSequenceEntry[],
  ): IntroScreenViewModel {
    if (introPhase === 'done') {
      return { visibleText: '', isVisible: false };
    }

    const page = introPages[introPageIndex];
    if (page === undefined) {
      return { visibleText: '', isVisible: false };
    }

    const text = page.text;
    let visibleText: string;

    switch (introPhase) {
      case 'typing':
        visibleText = text.slice(0, Math.floor(introTypingProgress * text.length));
        break;
      case 'hold':
        visibleText = text;
        break;
      case 'erasing':
        // progress가 1→0 이므로 남은 글자 수가 줄어든다
        visibleText = text.slice(0, Math.floor(introTypingProgress * text.length));
        break;
      default:
        visibleText = '';
    }

    return { visibleText, isVisible: true };
  }

  /**
   * buildGameClearViewModel — GameClear 화면 ViewModel 생성.
   *
   * isNewHighScore: score >= highScore && score > 0
   * ({0} 템플릿을 실제 숫자로 치환)
   */
  buildGameClearViewModel(
    session: Readonly<GameSessionState>,
    uiTexts: readonly UITextEntry[],
  ): GameClearViewModel {
    const headline = this.lookupText(uiTexts, 'txt_gameclear');
    const finalScoreTemplate = this.lookupText(uiTexts, 'txt_gameclear_final_score');
    const highScoreTemplate = this.lookupText(uiTexts, 'txt_title_highscore');
    const retryText = this.lookupText(uiTexts, 'txt_gameclear_retry');

    const finalScoreLabel = finalScoreTemplate.replace('{0}', String(session.score));
    const highScoreLabel = highScoreTemplate.replace('{0}', String(session.highScore));
    const isNewHighScore = session.score > 0 && session.score >= session.highScore;

    return {
      headline,
      finalScoreLabel,
      highScoreLabel,
      retryText,
      isNewHighScore,
    };
  }

  private lookupText(uiTexts: readonly UITextEntry[], textId: string): string {
    const entry = uiTexts.find((e) => e.textId === textId);
    return entry?.value ?? textId;
  }
}
