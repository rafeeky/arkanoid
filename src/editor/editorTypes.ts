// src/editor/editorTypes.ts
// 에디터 전용 상태 타입. core 레이어에서 독립.

// ─── 블록 팔레트 ──────────────────────────────────────────────────────────────

export type BlockTypeId =
  | 'basic'
  | 'basic_drop'
  | 'magnet_drop'
  | 'laser_drop'
  | 'tough'
  | 'empty';

export type SpinnerTypeId = 'spinner_cube' | 'spinner_triangle';

// ─── 그리드 배치 ─────────────────────────────────────────────────────────────

export type EditorBlockPlacement = {
  row: number;
  col: number;
  definitionId: BlockTypeId;
};

export type EditorSpinnerPlacement = {
  id: string; // 에디터 내부 식별자
  definitionId: SpinnerTypeId;
  x: number;
  y: number;
};

// ─── 스테이지 메타데이터 ──────────────────────────────────────────────────────

export type StageMetadata = {
  stageId: string;
  displayName: string;
  backgroundId: string;
  barSpawnX: number;
  barSpawnY: number;
  ballSpawnX: number;
  ballSpawnY: number;
  ballInitialSpeed: number;
  ballInitialAngleDeg: number;
};

// ─── 스테이지 슬롯 (탭 단위 편집 데이터) ────────────────────────────────────

export type StageSlotState = {
  metadata: StageMetadata;
  blocks: EditorBlockPlacement[];
  spinners: EditorSpinnerPlacement[];
};

// ─── 에디터 상태 ─────────────────────────────────────────────────────────────

export type EditorState = {
  // 멀티 스테이지 탭
  stages: [StageSlotState, StageSlotState, StageSlotState];
  activeStageIndex: 0 | 1 | 2;

  // 팔레트 / 인터랙션 (활성 스테이지와 독립)
  selectedBlockType: BlockTypeId;
  selectedSpinnerType: SpinnerTypeId | null;
  isSpinnerPlacementMode: boolean;
  selectedSpinnerId: string | null;
  isDraggingSpinner: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
};

// ─── Bulk JSON 포맷 ──────────────────────────────────────────────────────────

export type AllStagesJson = StageJson[];

// ─── 그리드 레이아웃 상수 ────────────────────────────────────────────────────

export const GRID_COLS = 9;
export const GRID_ROWS = 7;
export const BLOCK_W = 72;
export const BLOCK_H = 24;
export const BLOCK_GAP = 4;
export const GRID_OFFSET_X = 16;
export const GRID_OFFSET_Y = 16;
export const CANVAS_W = 720;
export const CANVAS_H = 720;

// ─── 팔레트 색상 ─────────────────────────────────────────────────────────────

export const BLOCK_COLORS: Record<BlockTypeId, string> = {
  basic: '#888888',
  basic_drop: '#ccaa00',
  magnet_drop: '#3377cc',
  laser_drop: '#cc3333',
  tough: '#444444',
  empty: '#111111',
};

export const BLOCK_LABELS: Record<BlockTypeId, string> = {
  basic: 'Basic',
  basic_drop: 'Basic Drop',
  magnet_drop: 'Magnet Drop',
  laser_drop: 'Laser Drop',
  tough: 'Tough (x2)',
  empty: 'Empty (erase)',
};

export const SPINNER_COLORS: Record<SpinnerTypeId, string> = {
  spinner_cube: '#00ccaa',
  spinner_triangle: '#cc88ff',
};

// ─── Stage JSON 출력 스키마 ──────────────────────────────────────────────────
// stage*.json 포맷과 1:1 대응

export type StageBlockPlacementJson = {
  row: number;
  col: number;
  definitionId: string;
};

export type StageSpinnerPlacementJson = {
  definitionId: string;
  x: number;
  y: number;
};

export type StageJson = {
  stageId: string;
  displayName: string;
  backgroundId: string;
  barSpawnX: number;
  barSpawnY: number;
  ballSpawnX: number;
  ballSpawnY: number;
  ballInitialSpeed: number;
  ballInitialAngleDeg: number;
  blocks: StageBlockPlacementJson[];
  spinners?: StageSpinnerPlacementJson[];
};
