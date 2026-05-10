import type { DifficultyKind } from '../../definitions/types/DifficultyKind';

export type TitleScreenViewModel = {
  startText: string;
  highScore: number;
  /** 현재 커서로 선택된 난이도 (묶음 E). */
  selectedDifficulty: DifficultyKind;
};
