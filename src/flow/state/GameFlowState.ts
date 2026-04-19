export type FlowStateKind = 'title' | 'roundIntro' | 'inGame' | 'gameOver';

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
