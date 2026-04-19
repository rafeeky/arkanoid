export type IntroSequenceFinishedEvent = { type: 'IntroSequenceFinished' };

export type RoundIntroFinishedEvent = { type: 'RoundIntroFinished' };

export type LifeLostPresentationFinishedEvent = {
  type: 'LifeLostPresentationFinished';
};

export type PresentationEvent =
  | IntroSequenceFinishedEvent
  | RoundIntroFinishedEvent
  | LifeLostPresentationFinishedEvent;
