export type FlowStateKind = 'title' | 'introStory' | 'roundIntro' | 'inGame' | 'gameOver' | 'gameClear';

export type GameFlowState = {
  kind: FlowStateKind;
  currentStageIndex: number;
};

export function createInitialGameFlowState(): GameFlowState {
  return {
    kind: 'title',
    currentStageIndex: 0,
  };
}
