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

/**
 * 공이 바에 부딪혀 반사되었다 (자석 부착은 제외).
 * 바 튕김 사운드(저음, pitch 0.7) 트리거. Unity 묶음 A 이식.
 */
export type BallHitBarEvent = {
  type: 'BallHitBar';
  ballId: string;
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
  | BallHitBarEvent
  | LaserFiredEvent
  | BlockHitEvent
  | BlockDestroyedEvent
  | ItemSpawnedEvent
  | ItemCollectedEvent
  | LifeLostEvent
  | StageClearedEvent
  | GameOverConditionMetEvent;
