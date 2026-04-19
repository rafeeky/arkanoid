import type { GameSessionState } from '../../gameplay/state/GameSessionState';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';
import type { HudViewModel } from '../view-models/HudViewModel';

/**
 * HUDPresenter — InGame 상단 HUD용 ViewModel 생성기.
 *
 * 규칙 계산 금지. session + runtimeState 값을 HudViewModel로 매핑만 한다.
 * Unity 매핑: HudView MonoBehaviour의 Binder 역할.
 */
export class HUDPresenter {
  /**
   * buildHudViewModel — GameplayRuntimeState 전체를 받아 HudViewModel을 생성한다.
   *
   * session 필드 외에 activeEffect / magnetRemainingMs / laserCooldownMs를 함께 반영한다.
   */
  buildHudViewModel(gameplayState: Readonly<GameplayRuntimeState>): HudViewModel;
  /**
   * @deprecated session만 받는 오버로드. 이전 호출부와의 호환을 위해 유지하나, 신규 코드는 GameplayRuntimeState 오버로드 사용.
   */
  buildHudViewModel(session: Readonly<GameSessionState>): HudViewModel;
  buildHudViewModel(
    arg: Readonly<GameplayRuntimeState> | Readonly<GameSessionState>,
  ): HudViewModel {
    // GameplayRuntimeState 인지 GameSessionState 인지 구별: 'session' 키 유무
    if ('session' in arg) {
      // GameplayRuntimeState 경로
      const state = arg as Readonly<GameplayRuntimeState>;
      const session = state.session;
      return {
        score: session.score,
        lives: session.lives,
        round: session.currentStageIndex + 1,
        activeEffect: state.bar.activeEffect,
        magnetRemainingMs: state.magnetRemainingTime,
        laserCooldownMs: state.laserCooldownRemaining,
      };
    } else {
      // GameSessionState 경로 (레거시 호환)
      const session = arg as Readonly<GameSessionState>;
      return {
        score: session.score,
        lives: session.lives,
        round: session.currentStageIndex + 1,
        activeEffect: 'none',
        magnetRemainingMs: 0,
        laserCooldownMs: 0,
      };
    }
  }
}
