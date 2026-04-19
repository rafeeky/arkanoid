import {
  createInitialGameFlowState,
  type GameFlowState,
} from '../state/GameFlowState';
import { nextState, type FlowCommand } from './FlowTransitionPolicy';
import { resolveFlowCommand } from './FlowInputResolver';
import { onEnter } from './FlowLifecycleHandler';
import type { FlowEvent } from '../events/flowEvents';
import type { GameplayEvent } from '../../gameplay/events/gameplayEvents';
import type { PresentationEvent } from '../../presentation/events/presentationEvents';
import type { InputSnapshot } from '../../input/InputSnapshot';

type FlowEventListener = (event: FlowEvent) => void;

export type GameFlowControllerOptions = {
  /** 총 스테이지 수. 마지막 스테이지 판정에 사용. 기본값 1. */
  totalStageCount?: number;
};

/**
 * Flow 상태기계 전체를 orchestration 한다.
 *
 * 책임:
 * - 비인게임 입력을 FlowCommand 로 변환해 상태 전이 시도
 * - Gameplay 이벤트 중 Flow 가 반응해야 하는 것을 FlowCommand 로 변환
 * - Presentation 이벤트 중 Flow 가 반응해야 하는 것을 FlowCommand 로 변환
 * - 상태 전이 확정 후 Entered 이벤트 발행
 *
 * LifeLost 처리 정책:
 * - remainingLives > 0  →  LifeLost 커맨드로 전달 (RoundIntro 전이)
 * - remainingLives === 0  →  GameOverConditionMet 커맨드로 변환해서 전달 (GameOver 전이)
 *
 * StageCleared 처리 정책 (mvp2 §11-3):
 * - Gameplay 는 StageCleared 만 발행한다. 마지막 스테이지 여부는 Flow 가 판정.
 * - currentStageIndex + 1 === totalStageCount 이면 isLastStage=true (GameClear 전이)
 * - 아니면 isLastStage=false (RoundIntro 전이 + currentStageIndex 증가)
 *
 * StartGameRequested 시 currentStageIndex 를 0 으로 리셋한다.
 */
export class GameFlowController {
  private state: GameFlowState;
  private readonly listener: FlowEventListener;
  private readonly totalStageCount: number;

  constructor(listener: FlowEventListener, options?: GameFlowControllerOptions) {
    this.state = createInitialGameFlowState();
    this.listener = listener;
    this.totalStageCount = options?.totalStageCount ?? 1;
  }

  getState(): Readonly<GameFlowState> {
    return this.state;
  }

  handleInput(input: InputSnapshot): void {
    const command = resolveFlowCommand(this.state.kind, input);
    if (command !== null) {
      this.applyCommand(command);
    }
  }

  handleGameplayEvent(event: GameplayEvent): void {
    const command = this.translateGameplayEvent(event);
    if (command !== null) {
      this.applyCommand(command);
    }
  }

  handlePresentationEvent(event: PresentationEvent): void {
    const command = this.translatePresentationEvent(event);
    if (command !== null) {
      this.applyCommand(command);
    }
  }

  private translateGameplayEvent(event: GameplayEvent): FlowCommand | null {
    switch (event.type) {
      case 'LifeLost':
        if (event.remainingLives > 0) {
          return { type: 'LifeLost', remainingLives: event.remainingLives };
        }
        return { type: 'GameOverConditionMet' };

      case 'StageCleared': {
        const isLastStage =
          this.state.currentStageIndex + 1 >= this.totalStageCount;
        return { type: 'StageCleared', isLastStage };
      }

      case 'GameOverConditionMet':
        return { type: 'GameOverConditionMet' };

      default:
        return null;
    }
  }

  private translatePresentationEvent(
    event: PresentationEvent,
  ): FlowCommand | null {
    switch (event.type) {
      case 'IntroSequenceFinished':
        return { type: 'IntroSequenceFinished' };

      case 'RoundIntroFinished':
        return { type: 'RoundIntroFinished' };

      case 'LifeLostPresentationFinished':
        // Flow 는 이 이벤트를 직접 상태 전이에 사용하지 않는다.
        return null;

      default:
        return null;
    }
  }

  private applyCommand(command: FlowCommand): void {
    const from = this.state.kind;
    const next = nextState(from, command);
    if (next === null) return;

    let nextStageIndex = this.state.currentStageIndex;

    if (command.type === 'StartGameRequested') {
      // 새 게임 시작: stageIndex 리셋
      nextStageIndex = 0;
    } else if (
      command.type === 'StageCleared' &&
      !command.isLastStage
    ) {
      // 다음 스테이지로 진행: stageIndex 증가
      nextStageIndex = this.state.currentStageIndex + 1;
    }

    this.state = {
      kind: next,
      currentStageIndex: nextStageIndex,
    };

    this.listener(onEnter(next, from));
  }
}
