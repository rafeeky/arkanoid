import type { FlowStateKind } from '../state/GameFlowState';
import type { FlowCommand } from './FlowTransitionPolicy';
import type { InputSnapshot } from '../../input/InputSnapshot';

/**
 * 비인게임 상태(Title, GameOver, GameClear)에서 InputSnapshot 을 FlowCommand 로 해석한다.
 * IntroStory / RoundIntro / InGame 에서는 입력 기반 FlowCommand 를 거의 만들지 않지만
 * Q 복귀(묶음 F)는 모든 비-Title 상태에서 허용한다.
 *
 * 우선순위: Q (복귀) → Title 난이도 커서(←/→) → Space.
 *
 * 순수 함수. 외부 상태 없음.
 */
export function resolveFlowCommand(
  state: FlowStateKind,
  input: InputSnapshot,
): FlowCommand | null {
  // 묶음 F: Q 로 어디서든 타이틀 복귀 (Title 자신에서는 무시)
  if (input.qJustPressed && state !== 'title') {
    return { type: 'ReturnToTitleRequested' };
  }

  if (state === 'title') {
    // 묶음 E: 방향키 edge 로 난이도 커서 이동 (NORMAL/HARD)
    if (input.leftJustPressed) return { type: 'DifficultySelectNormal' };
    if (input.rightJustPressed) return { type: 'DifficultySelectHard' };
    if (input.spaceJustPressed) return { type: 'StartGameRequested' };
    return null;
  }

  if (state === 'gameOver' && input.spaceJustPressed) {
    return { type: 'RetryRequested' };
  }

  if (state === 'gameClear' && input.spaceJustPressed) {
    return { type: 'RetryRequested' };
  }

  return null;
}
