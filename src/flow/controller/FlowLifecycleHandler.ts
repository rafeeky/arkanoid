import type { FlowStateKind } from '../state/GameFlowState';
import type { FlowEvent } from '../events/flowEvents';

/**
 * 새 상태에 진입할 때 발행해야 할 FlowEvent 를 반환한다.
 * 순수 함수. 외부 상태 없음.
 */
export function onEnter(newState: FlowStateKind): FlowEvent {
  switch (newState) {
    case 'title':
      return { type: 'EnteredTitle' };
    case 'roundIntro':
      return { type: 'EnteredRoundIntro' };
    case 'inGame':
      return { type: 'EnteredInGame' };
    case 'gameOver':
      return { type: 'EnteredGameOver' };
  }
}
