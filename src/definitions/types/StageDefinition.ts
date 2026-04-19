import type { StageBlockPlacement } from './StageBlockPlacement';
import type { StageSpinnerPlacement } from './StageSpinnerPlacement';

export type StageDefinition = {
  stageId: string;
  displayName: string;
  backgroundId: string;
  barSpawnX: number;
  barSpawnY: number;
  ballSpawnX: number;
  ballSpawnY: number;
  ballInitialSpeed: number;
  ballInitialAngleDeg: number;
  blocks: StageBlockPlacement[];
  spinners?: StageSpinnerPlacement[];
};
