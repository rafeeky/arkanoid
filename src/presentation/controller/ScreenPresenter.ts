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
  ): RoundIntroViewModel {
    const roundLabel = this.lookupText(uiTexts, 'txt_round_01');
    const readyLabel = this.lookupText(uiTexts, 'txt_ready');
    return {
      roundLabel,
      readyLabel,
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
