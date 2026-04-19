export type BallLaunchedEvent = { type: 'BallLaunched' };

export type BlockHitEvent = {
  type: 'BlockHit';
  blockId: string;
  remainingHits: number;
};

export type BlockDestroyedEvent = {
  type: 'BlockDestroyed';
  blockId: string;
  scoreDelta: number;
};

export type ItemSpawnedEvent = {
  type: 'ItemSpawned';
  itemId: string;
  itemType: 'expand';
  x: number;
  y: number;
};

export type ItemCollectedEvent = {
  type: 'ItemCollected';
  itemType: 'expand';
  replacedEffect: 'none' | 'expand';
  newEffect: 'none' | 'expand';
};

export type LifeLostEvent = {
  type: 'LifeLost';
  remainingLives: number;
};

export type StageClearedEvent = { type: 'StageCleared' };

export type GameOverConditionMetEvent = { type: 'GameOverConditionMet' };

export type GameplayEvent =
  | BallLaunchedEvent
  | BlockHitEvent
  | BlockDestroyedEvent
  | ItemSpawnedEvent
  | ItemCollectedEvent
  | LifeLostEvent
  | StageClearedEvent
  | GameOverConditionMetEvent;
