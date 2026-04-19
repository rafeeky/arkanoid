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
 * StartGameRequested 시 currentStageIndex 를 0 으로 리셋한다.
 */
export class GameFlowController {
  private state: GameFlowState;
  private readonly listener: FlowEventListener;

  constructor(listener: FlowEventListener) {
    this.state = createInitialGameFlowState();
    this.listener = listener;
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

      case 'StageCleared':
        return { type: 'StageCleared' };

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
      case 'RoundIntroFinished':
        return { type: 'RoundIntroFinished' };

      default:
        return null;
    }
  }

  private applyCommand(command: FlowCommand): void {
    const from = this.state.kind;
    const next = nextState(from, command);
    if (next === null) return;

    const nextStageIndex =
      command.type === 'StartGameRequested' ? 0 : this.state.currentStageIndex;

    this.state = {
      kind: next,
      currentStageIndex: nextStageIndex,
    };

    this.listener(onEnter(next, from));
  }
}
