import type { FlowStateKind } from '../state/GameFlowState';

export type EnteredTitleEvent = { type: 'EnteredTitle'; from: FlowStateKind };
export type EnteredRoundIntroEvent = { type: 'EnteredRoundIntro'; from: FlowStateKind };
export type EnteredInGameEvent = { type: 'EnteredInGame'; from: FlowStateKind };
export type EnteredGameOverEvent = { type: 'EnteredGameOver'; from: FlowStateKind };

export type FlowEvent =
  | EnteredTitleEvent
  | EnteredRoundIntroEvent
  | EnteredInGameEvent
  | EnteredGameOverEvent;
