export type EnteredTitleEvent = { type: 'EnteredTitle' };
export type EnteredRoundIntroEvent = { type: 'EnteredRoundIntro' };
export type EnteredInGameEvent = { type: 'EnteredInGame' };
export type EnteredGameOverEvent = { type: 'EnteredGameOver' };

export type FlowEvent =
  | EnteredTitleEvent
  | EnteredRoundIntroEvent
  | EnteredInGameEvent
  | EnteredGameOverEvent;
