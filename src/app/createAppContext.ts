import { GameFlowController } from '../flow/controller/GameFlowController';
import { GameplayController } from '../gameplay/controller/GameplayController';
import { GameplayLifecycleHandler } from '../gameplay/controller/GameplayLifecycleHandler';
import type { GameFlowState } from '../flow/state/GameFlowState';
import type { GameplayRuntimeState } from '../gameplay/state/GameplayRuntimeState';
import type { InputSnapshot } from '../input/InputSnapshot';
import type { FlowEvent } from '../flow/events/flowEvents';
import type { GameplayEvent } from '../gameplay/events/gameplayEvents';

import { StageDefinitionTable } from '../definitions/tables/StageDefinitionTable';
import { BlockDefinitionTable } from '../definitions/tables/BlockDefinitionTable';
import { ItemDefinitionTable } from '../definitions/tables/ItemDefinitionTable';
import { GameplayConfigTable } from '../definitions/tables/GameplayConfigTable';

/**
 * AppContext: 모든 의존성의 조립 지점.
 *
 * 공개 API:
 * - tick(input, dt): 단일 틱 엔트리. flowController.handleInput 후,
 *   flowState === 'inGame' 이면 gameplayController.tick 실행 (architecture §17).
 * - getFlowState(): 현재 FlowState 읽기 전용 조회.
 * - getGameplayState(): 현재 GameplayRuntimeState 읽기 전용 조회.
 * - handlePresentationEvent: Presentation 이벤트를 FlowController 에 전달.
 *
 * 이벤트 배선:
 * - gameplayController 이벤트 → flowController.handleGameplayEvent
 * - flowController 이벤트:
 *   - EnteredRoundIntro + from === 'title'  → lifecycleHandler.initializeStage (새 게임)
 *   - EnteredRoundIntro + from === 'inGame' → lifecycleHandler.resetForRetry (재시도)
 */
export type AppContext = {
  tick(input: InputSnapshot, dt: number): void;
  getFlowState(): Readonly<GameFlowState>;
  getGameplayState(): Readonly<GameplayRuntimeState>;
  handlePresentationEvent(event: import('../presentation/events/presentationEvents').PresentationEvent): void;
};

export function createAppContext(): AppContext {
  const config = GameplayConfigTable;
  const stage1 = StageDefinitionTable[0]!;

  const lifecycleHandler = new GameplayLifecycleHandler(BlockDefinitionTable);

  // GameplayController 는 초기 상태가 필요하다.
  // Title 진입 시점에는 아직 게임이 시작되지 않았으므로,
  // 빈 placeholder 상태로 초기화하고 EnteredRoundIntro(from='title') 때 교체한다.
  const placeholderState: GameplayRuntimeState = lifecycleHandler.initializeStage(
    stage1,
    config,
    config.initialLives,
  );

  const gameplayController = new GameplayController(placeholderState, {
    blockDefinitions: BlockDefinitionTable,
    itemDefinitions: ItemDefinitionTable,
    config,
  });

  // FlowController: Gameplay 이벤트를 받아 Flow 전이를 처리한다.
  const flowController = new GameFlowController((flowEvent: FlowEvent) => {
    onFlowEvent(flowEvent);
  });

  // Gameplay → Flow 배선
  // GameplayController 는 tick 결과로 이벤트 배열을 반환하므로,
  // tick wrapper 에서 라우팅한다 (subscribe 패턴 대신 반환값 사용).

  // Flow 이벤트 핸들러 (forward declaration 패턴)
  function onFlowEvent(event: FlowEvent): void {
    if (event.type === 'EnteredRoundIntro') {
      if (event.from === 'title') {
        // 새 게임 시작: Stage 1 완전 초기화
        const newState = lifecycleHandler.initializeStage(
          stage1,
          config,
          config.initialLives,
        );
        gameplayController.setState(newState);
      } else if (event.from === 'inGame') {
        // 라이프 손실 후 재시도: 블록/점수/라이프 유지, 위치만 리셋
        const currentState = gameplayController.getState();
        const resetState = lifecycleHandler.resetForRetry(
          currentState as GameplayRuntimeState,
          stage1,
          config,
        );
        gameplayController.setState(resetState);
      }
    }
  }

  function tick(input: InputSnapshot, dt: number): void {
    // Flow 입력 처리 (Title, GameOver 등 비인게임 상태에서의 입력)
    flowController.handleInput(input);

    // InGame 상태일 때만 Gameplay 틱 실행 (architecture §17)
    if (flowController.getState().kind === 'inGame') {
      const gameplayEvents: GameplayEvent[] = gameplayController.tick(input, dt);
      for (const event of gameplayEvents) {
        flowController.handleGameplayEvent(event);
      }
    }
  }

  function getFlowState(): Readonly<GameFlowState> {
    return flowController.getState();
  }

  function getGameplayState(): Readonly<GameplayRuntimeState> {
    return gameplayController.getState() as Readonly<GameplayRuntimeState>;
  }

  function handlePresentationEvent(
    event: import('../presentation/events/presentationEvents').PresentationEvent,
  ): void {
    flowController.handlePresentationEvent(event);
  }

  return {
    tick,
    getFlowState,
    getGameplayState,
    handlePresentationEvent,
  };
}
