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

/** バー効果の全種別。Phase 3/4/5 で itemType も拡張予定。 */
export type BarEffectKind = 'none' | 'expand' | 'magnet' | 'laser';

export type ItemCollectedEvent = {
  type: 'ItemCollected';
  // TODO(mvp3-phase3): itemType を 'expand' | 'magnet' | 'laser' に拡張する
  itemType: 'expand';
  replacedEffect: BarEffectKind;
  newEffect: BarEffectKind;
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
