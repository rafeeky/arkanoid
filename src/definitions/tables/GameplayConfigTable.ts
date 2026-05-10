import type { GameplayConfig } from '../types/GameplayConfig';

export const GameplayConfigTable: GameplayConfig = {
  initialLives: 3,
  baseBarWidth: 120,
  barMoveSpeed: 420,
  ballInitialSpeed: 588,
  ballInitialAngleDeg: -60,
  // RoundIntro: 2초 동안 READY 연출 (바 깜빡 + 공 부착 + 짧은 BGM). Unity 묶음 이식.
  roundIntroDurationMs: 2000,
  blockHitFlashDurationMs: 120,
  barBreakDurationMs: 700,
  expandMultiplier: 1.5,
};
