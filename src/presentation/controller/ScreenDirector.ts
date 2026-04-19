import type { GameFlowState } from '../../flow/state/GameFlowState';
import type { ScreenState } from '../state/ScreenState';

/**
 * ScreenDirector — ScreenState 소유 및 시간 기반 갱신.
 *
 * flowState.kind 변화에 따라 currentScreen을 동기화하고,
 * roundIntro 상태일 때 타이머를 감소시킨다.
 * blockHitFlashBlockIds / isBarBreaking은 Phase 6에서 확장 예정.
 *
 * Unity 매핑: ScreenViewRoot MonoBehaviour. Update()에서 이 메서드들을 호출한다.
 */
export class ScreenDirector {
  private screenState: ScreenState;
  private readonly roundIntroDurationMs: number;
  private prevFlowKind: GameFlowState['kind'] | null = null;

  constructor(roundIntroDurationMs: number) {
    this.roundIntroDurationMs = roundIntroDurationMs;
    this.screenState = {
      currentScreen: 'title',
      roundIntroRemainingTime: roundIntroDurationMs,
      blockHitFlashBlockIds: [],
      isBarBreaking: false,
    };
  }

  update(flowState: Readonly<GameFlowState>, deltaMs: number): void {
    const kind = flowState.kind;

    // RoundIntro 진입 시 타이머 리셋
    if (kind === 'roundIntro' && this.prevFlowKind !== 'roundIntro') {
      this.screenState = {
        ...this.screenState,
        roundIntroRemainingTime: this.roundIntroDurationMs,
      };
    }

    // currentScreen 동기화
    this.screenState = {
      ...this.screenState,
      currentScreen: kind,
    };

    // roundIntro 중 타이머 감소
    if (kind === 'roundIntro') {
      const next = this.screenState.roundIntroRemainingTime - deltaMs;
      this.screenState = {
        ...this.screenState,
        roundIntroRemainingTime: next < 0 ? 0 : next,
      };
    }

    this.prevFlowKind = kind;
  }

  getScreenState(): Readonly<ScreenState> {
    return this.screenState;
  }
}
