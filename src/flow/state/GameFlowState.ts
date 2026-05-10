import type { DifficultyKind } from '../../definitions/types/DifficultyKind';

export type FlowStateKind = 'title' | 'introStory' | 'roundIntro' | 'inGame' | 'gameOver' | 'gameClear';

export type GameFlowState = {
  kind: FlowStateKind;
  currentStageIndex: number;
  /** Title 화면에서 커서로 선택된 난이도 (묶음 E). 기본 'normal'. */
  selectedDifficulty: DifficultyKind;
};

export function createInitialGameFlowState(): GameFlowState {
  return {
    kind: 'title',
    currentStageIndex: 0,
    selectedDifficulty: 'normal',
  };
}
