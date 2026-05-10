import type { DifficultyConfig } from '../types/DifficultyConfig';
import type { DifficultyKind } from '../types/DifficultyKind';

/**
 * 난이도별 DifficultyConfig 룩업 테이블 (묶음 E).
 * Unity DifficultyConfigTable 의 TS 매핑.
 *
 * Normal: Lives 5, 스피너 OFF
 * Hard:   Lives 3, 스피너 ON
 */
export const DifficultyConfigTable: Record<DifficultyKind, DifficultyConfig> = {
  normal: {
    kind:            'normal',
    initialLives:    5,
    spinnersEnabled: false,
  },
  hard: {
    kind:            'hard',
    initialLives:    3,
    spinnersEnabled: true,
  },
};

/** Convenience accessor (Unity DifficultyConfigTable.Get 매핑). */
export function getDifficultyConfig(kind: DifficultyKind): DifficultyConfig {
  return DifficultyConfigTable[kind];
}
