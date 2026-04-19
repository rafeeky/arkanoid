export type RoundIntroFinishedEvent = { type: 'RoundIntroFinished' };

export type LifeLostPresentationFinishedEvent = {
  type: 'LifeLostPresentationFinished';
};

export type PresentationEvent =
  | RoundIntroFinishedEvent
  | LifeLostPresentationFinishedEvent;
