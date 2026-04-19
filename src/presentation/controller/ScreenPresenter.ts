import type { GameSessionState } from '../../gameplay/state/GameSessionState';
import type { UITextEntry } from '../../definitions/types/UITextEntry';
import type { TitleScreenViewModel } from '../view-models/TitleScreenViewModel';
import type { RoundIntroViewModel } from '../view-models/RoundIntroViewModel';
import type { GameOverViewModel } from '../view-models/GameOverViewModel';

/**
 * ScreenPresenter — flowState + gameplayState → ViewModel 변환기.
 *
 * 규칙 계산/판단 금지. 읽기 전용 매퍼.
 * Unity 매핑: TitleScreenView, RoundIntroView, GameOverView에 각각 대응되는
 * Binder 역할의 MonoBehaviour로 분리된다.
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
    const roundLabel = this.lookupText(uiTexts, 'txt_round_01');
    const readyLabel = this.lookupText(uiTexts, 'txt_ready');
    // introProgress: 0.0(시작) ~ 1.0(종료). 남은 시간이 줄어들수록 1에 가까워짐.
    const elapsed = roundIntroDurationMs - roundIntroRemainingTime;
    const introProgress =
      roundIntroDurationMs > 0
        ? Math.max(0, Math.min(1, elapsed / roundIntroDurationMs))
        : 1;
    // session 은 현재 미사용. 향후 스테이지 번호 표시 시 사용.
    void session;
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
    const retryText = this.lookupText(uiTexts, 'txt_retry');
    return {
      gameOverLabel,
      finalScore: session.score,
      retryText,
    };
  }

  private lookupText(uiTexts: readonly UITextEntry[], textId: string): string {
    const entry = uiTexts.find((e) => e.textId === textId);
    return entry?.value ?? textId;
  }
}
