import type { GameFlowState } from '../../flow/state/GameFlowState';
import { createInitialScreenState } from '../state/ScreenState';
import type { ScreenState } from '../state/ScreenState';
import type { PresentationEvent } from '../events/presentationEvents';
import { VisualEffectController } from './VisualEffectController';

/**
 * ScreenDirector — ScreenState 소유 및 시간 기반 갱신.
 *
 * flowState.kind 변화에 따라 currentScreen을 동기화하고,
 * roundIntro 상태일 때 타이머를 감소시킨다.
 * VisualEffectController를 내부에서 update 호출하여 ScreenState에 반영한다.
 * introStory 진입 첫 프레임에 VisualEffectController.startIntroSequence()를 호출한다.
 *
 * Unity 매핑: ScreenViewRoot MonoBehaviour. Update()에서 이 메서드들을 호출한다.
 */
export class ScreenDirector {
  private screenState: ScreenState;
  private readonly roundIntroDurationMs: number;
  private prevFlowKind: GameFlowState['kind'] | null = null;
  private readonly visualEffectController: VisualEffectController;

  constructor(
    roundIntroDurationMs: number,
    visualEffectController: VisualEffectController,
  ) {
    this.roundIntroDurationMs = roundIntroDurationMs;
    this.visualEffectController = visualEffectController;
    this.screenState = createInitialScreenState(roundIntroDurationMs);
  }

  update(
    flowState: Readonly<GameFlowState>,
    deltaMs: number,
    emitPresentationEvent: (e: PresentationEvent) => void,
  ): void {
    const kind = flowState.kind;

    // introStory 진입 첫 프레임: Intro 시퀀스 시작
    if (kind === 'introStory' && this.prevFlowKind !== 'introStory') {
      this.visualEffectController.startIntroSequence();
    }

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

    // VisualEffectController 갱신 후 ScreenState 에 반영
    this.visualEffectController.update(deltaMs, emitPresentationEvent);

    this.screenState = {
      ...this.screenState,
      blockHitFlashBlockIds: this.visualEffectController.getFlashingBlockIds() as string[],
      isBarBreaking: this.visualEffectController.isBarBreaking(),
      introPageIndex: this.visualEffectController.getIntroPageIndex(),
      introTypingProgress: this.visualEffectController.getIntroTypingProgress(),
      introPhase: this.visualEffectController.getIntroPhase(),
    };

    this.prevFlowKind = kind;
  }

  getScreenState(): Readonly<ScreenState> {
    return this.screenState;
  }

  /** VisualEffectController 에 직접 접근이 필요한 경우 (렌더러에서 progress 조회 등) */
  getVisualEffectController(): VisualEffectController {
    return this.visualEffectController;
  }
}
