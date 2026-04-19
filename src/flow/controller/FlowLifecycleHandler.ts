import type { FlowStateKind } from '../state/GameFlowState';
import type { FlowEvent } from '../events/flowEvents';

/**
 * 새 상태에 진입할 때 발행해야 할 FlowEvent 를 반환한다.
 * 순수 함수. 외부 상태 없음.
 *
 * from: 전이 직전 상태 (AppContext 등에서 분기에 활용)
 */
export function onEnter(newState: FlowStateKind, from: FlowStateKind): FlowEvent {
  switch (newState) {
    case 'title':
      return { type: 'EnteredTitle', from };
    case 'roundIntro':
      return { type: 'EnteredRoundIntro', from };
    case 'inGame':
      return { type: 'EnteredInGame', from };
    case 'gameOver':
      return { type: 'EnteredGameOver', from };
  }
}
