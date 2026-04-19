export type BallLaunchedEvent = { type: 'BallLaunched' };

export type BallAttachedEvent = {
  type: 'BallAttached';
  ballIds: readonly string[];
};

export type BallsReleasedEvent = {
  type: 'BallsReleased';
  ballIds: readonly string[];
  releaseReason: 'space' | 'timeout' | 'replaced';
};

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
  itemType: 'expand' | 'magnet' | 'laser';
  x: number;
  y: number;
};

/** 바 효과 전종별. */
export type BarEffectKind = 'none' | 'expand' | 'magnet' | 'laser';

export type ItemCollectedEvent = {
  type: 'ItemCollected';
  itemType: 'expand' | 'magnet' | 'laser';
  replacedEffect: BarEffectKind;
  newEffect: BarEffectKind;
};

export type LaserFiredEvent = {
  type: 'LaserFired';
  shotCount: number;
};

export type LifeLostEvent = {
  type: 'LifeLost';
  remainingLives: number;
};

export type StageClearedEvent = { type: 'StageCleared' };

export type GameOverConditionMetEvent = { type: 'GameOverConditionMet' };

export type GameplayEvent =
  | BallLaunchedEvent
  | BallAttachedEvent
  | BallsReleasedEvent
  | LaserFiredEvent
  | BlockHitEvent
  | BlockDestroyedEvent
  | ItemSpawnedEvent
  | ItemCollectedEvent
  | LifeLostEvent
  | StageClearedEvent
  | GameOverConditionMetEvent;
