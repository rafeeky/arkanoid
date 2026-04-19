import type { FlowStateKind } from '../state/GameFlowState';
import type { FlowCommand } from './FlowTransitionPolicy';
import type { InputSnapshot } from '../../input/InputSnapshot';

/**
 * 비인게임 상태(Title, GameOver, GameClear)에서 InputSnapshot 을 FlowCommand 로 해석한다.
 * IntroStory / RoundIntro / InGame 에서는 null 을 반환한다
 * (InGame 입력은 InputCommandResolver 담당).
 *
 * 순수 함수. 외부 상태 없음.
 */
export function resolveFlowCommand(
  state: FlowStateKind,
  input: InputSnapshot,
): FlowCommand | null {
  if (state === 'title' && input.spaceJustPressed) {
    return { type: 'StartGameRequested' };
  }

  if (state === 'gameOver' && input.spaceJustPressed) {
    return { type: 'RetryRequested' };
  }

  if (state === 'gameClear' && input.spaceJustPressed) {
    return { type: 'RetryRequested' };
  }

  return null;
}
