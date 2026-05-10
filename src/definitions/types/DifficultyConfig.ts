import type { DifficultyKind } from './DifficultyKind';

/**
 * 난이도별 설정값 (묶음 E).
 * Unity DifficultyConfig record 와 동일.
 */
export type DifficultyConfig = {
  kind: DifficultyKind;
  initialLives: number;
  spinnersEnabled: boolean;
};
