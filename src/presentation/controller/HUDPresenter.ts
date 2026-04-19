import type { GameSessionState } from '../../gameplay/state/GameSessionState';
import type { HudViewModel } from '../view-models/HudViewModel';

/**
 * HUDPresenter — InGame 상단 HUD용 ViewModel 생성기.
 *
 * 규칙 계산 금지. session 값을 HudViewModel로 매핑만 한다.
 * Unity 매핑: HudView MonoBehaviour의 Binder 역할.
 */
export class HUDPresenter {
  buildHudViewModel(session: Readonly<GameSessionState>): HudViewModel {
    return {
      score: session.score,
      lives: session.lives,
      round: session.currentStageIndex + 1,
    };
  }
}
