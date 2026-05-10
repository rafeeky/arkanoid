import type { FlowStateKind } from '../state/GameFlowState';

export type StartGameRequestedCommand = { type: 'StartGameRequested' };
export type IntroSequenceFinishedCommand = { type: 'IntroSequenceFinished' };
export type RoundIntroFinishedCommand = { type: 'RoundIntroFinished' };
export type LifeLostCommand = { type: 'LifeLost'; remainingLives: number };
export type GameOverConditionMetCommand = { type: 'GameOverConditionMet' };
export type StageClearedCommand = { type: 'StageCleared'; isLastStage: boolean };
export type RetryRequestedCommand = { type: 'RetryRequested' };
/** Q 키로 어디서든 타이틀 복귀 (묶음 F). */
export type ReturnToTitleRequestedCommand = { type: 'ReturnToTitleRequested' };
/** Title 화면 난이도 커서 NORMAL 선택 (묶음 E). intra-state 업데이트. */
export type DifficultySelectNormalCommand = { type: 'DifficultySelectNormal' };
/** Title 화면 난이도 커서 HARD 선택 (묶음 E). intra-state 업데이트. */
export type DifficultySelectHardCommand = { type: 'DifficultySelectHard' };

export type FlowCommand =
  | StartGameRequestedCommand
  | IntroSequenceFinishedCommand
  | RoundIntroFinishedCommand
  | LifeLostCommand
  | GameOverConditionMetCommand
  | StageClearedCommand
  | RetryRequestedCommand
  | ReturnToTitleRequestedCommand
  | DifficultySelectNormalCommand
  | DifficultySelectHardCommand;

/**
 * 순수 상태 전이 함수.
 * mvp2.md §7-2 상태 전이표 + 묶음 F (Q→Title 복귀) 반영.
 *
 * LifeLost 처리 정책:
 * - remainingLives > 0  →  RoundIntro
 * - remainingLives === 0 은 GameFlowController가 GameOverConditionMet 으로 변환해서 넘긴다.
 *
 * StageCleared 처리 정책:
 * - isLastStage === true  →  GameClear
 * - isLastStage === false →  RoundIntro (Controller가 stageIndex를 증가)
 *
 * Q 복귀 처리:
 * - 어떤 비-Title 상태에서든 ReturnToTitleRequested 수신 시 Title 로 전이.
 * - Title 자체에서는 무시 (FlowInputResolver 단계에서 막음).
 *
 * Difficulty 선택은 intra-state 이라 nextState 가 다루지 않는다 (GameFlowController 가 처리).
 *
 * @returns 다음 FlowStateKind, 또는 null(해당 상태에서 무효한 커맨드)
 */
export function nextState(
  current: FlowStateKind,
  command: FlowCommand,
): FlowStateKind | null {
  // Q 복귀: 비-Title 모든 상태에서 허용
  if (command.type === 'ReturnToTitleRequested' && current !== 'title') {
    return 'title';
  }

  switch (current) {
    case 'title':
      if (command.type === 'StartGameRequested') return 'introStory';
      return null;

    case 'introStory':
      if (command.type === 'IntroSequenceFinished') return 'roundIntro';
      return null;

    case 'roundIntro':
      if (command.type === 'RoundIntroFinished') return 'inGame';
      return null;

    case 'inGame':
      if (command.type === 'LifeLost' && command.remainingLives > 0)
        return 'roundIntro';
      if (command.type === 'GameOverConditionMet') return 'gameOver';
      if (command.type === 'StageCleared') {
        return command.isLastStage ? 'gameClear' : 'roundIntro';
      }
      return null;

    case 'gameOver':
      if (command.type === 'RetryRequested') return 'title';
      return null;

    case 'gameClear':
      if (command.type === 'RetryRequested') return 'title';
      return null;
  }
}
