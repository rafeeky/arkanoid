import type { FlowStateKind } from '../state/GameFlowState';

export type StartGameRequestedCommand = { type: 'StartGameRequested' };
export type IntroSequenceFinishedCommand = { type: 'IntroSequenceFinished' };
export type RoundIntroFinishedCommand = { type: 'RoundIntroFinished' };
export type LifeLostCommand = { type: 'LifeLost'; remainingLives: number };
export type GameOverConditionMetCommand = { type: 'GameOverConditionMet' };
export type StageClearedCommand = { type: 'StageCleared'; isLastStage: boolean };
export type RetryRequestedCommand = { type: 'RetryRequested' };

export type FlowCommand =
  | StartGameRequestedCommand
  | IntroSequenceFinishedCommand
  | RoundIntroFinishedCommand
  | LifeLostCommand
  | GameOverConditionMetCommand
  | StageClearedCommand
  | RetryRequestedCommand;

/**
 * 순수 상태 전이 함수.
 * mvp2.md §7-2 상태 전이표를 1:1 반영한다.
 *
 * LifeLost 처리 정책:
 * - remainingLives > 0  →  RoundIntro
 * - remainingLives === 0 は GameFlowController가 GameOverConditionMet 으로 변환해서 넘긴다.
 *   따라서 여기서는 LifeLost(remainingLives === 0) 케이스가 유입되지 않음을 가정하지 않고,
 *   방어적으로 null 을 반환한다 (Controller 책임).
 *
 * StageCleared 처리 정책:
 * - isLastStage === true  →  GameClear
 * - isLastStage === false →  RoundIntro (Controller가 stageIndex를 증가)
 *
 * @returns 다음 FlowStateKind, 또는 null(해당 상태에서 무효한 커맨드)
 */
export function nextState(
  current: FlowStateKind,
  command: FlowCommand,
): FlowStateKind | null {
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
