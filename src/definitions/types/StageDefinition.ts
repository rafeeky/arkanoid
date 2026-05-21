import type { StageBlockPlacement } from './StageBlockPlacement';
import type { StageBorderPlacement } from './StageBorderPlacement';
import type { StageDoorPlacement } from './StageDoorPlacement';
import type { StageSpinnerPlacement } from './StageSpinnerPlacement';
import type { TrailStyleId } from '../tables/TrailStyleTable';

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
  /** 플레이필드 테두리 (좌/우/상단). 선택. 없으면 빈 배열로 처리. */
  borders?: StageBorderPlacement[];
  /** 상단 테두리 위 문(door). 선택. 열리면 스피너 spawn (Checkpoint D). */
  doors?: StageDoorPlacement[];
  spinners?: StageSpinnerPlacement[];
  /** 공 파워 상태 트레일 스타일. 미지정 시 'golden_sun'. */
  trailStyle?: TrailStyleId;
};
