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

/** 에디터 모드. block 팔레트 / spinner 배치 / border 배치 / door 배치 중 1. */
export type EditorMode = 'block' | 'spinner' | 'border' | 'door';

/** Border 방향. horizontal=상단, vertical=좌/우. */
export type BorderOrientation = 'horizontal' | 'vertical';

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

export type EditorBorderPlacement = {
  row: number;
  col: number;
  orientation: BorderOrientation;
};

export type EditorDoorPlacement = {
  col: number;
  spinnerDefinitionId: SpinnerTypeId;
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
  borders: EditorBorderPlacement[];
  doors: EditorDoorPlacement[];
};

// ─── 에디터 상태 ─────────────────────────────────────────────────────────────

export type EditorState = {
  // 멀티 스테이지 탭
  stages: [StageSlotState, StageSlotState, StageSlotState];
  activeStageIndex: 0 | 1 | 2;

  // 팔레트 / 인터랙션 (활성 스테이지와 독립)
  mode: EditorMode;
  selectedBlockType: BlockTypeId;
  selectedSpinnerType: SpinnerTypeId | null;
  isSpinnerPlacementMode: boolean;
  selectedSpinnerId: string | null;
  isDraggingSpinner: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
  /** border 모드에서 다음에 놓을 방향. horizontal=상단, vertical=좌/우. */
  selectedBorderOrientation: BorderOrientation;
  /** door 모드에서 door가 spawn 시킬 스피너 정의. */
  selectedDoorSpinner: SpinnerTypeId;
};

// ─── Bulk JSON 포맷 ──────────────────────────────────────────────────────────

export type AllStagesJson = StageJson[];

// ─── 그리드 레이아웃 상수 ────────────────────────────────────────────────────
// 단일 소스 — playfieldLayout 에서 import. 편집기와 게임 런타임이 동일한 좌표로 렌더.
// 이전 편집기 로컬 값(BLOCK_W=72, GRID_OFFSET=16/16) 은 게임(64, 56/80) 과 어긋났음 — 동기화 완료.

export {
  BLOCK_WIDTH as BLOCK_W,
  BLOCK_HEIGHT as BLOCK_H,
  BLOCK_GAP,
  BLOCK_GRID_LEFT_MARGIN as GRID_OFFSET_X,
  BLOCK_GRID_START_Y as GRID_OFFSET_Y,
  PLAYFIELD_WIDTH as CANVAS_W,
  PLAYFIELD_HEIGHT as CANVAS_H,
  BLOCK_GRID_COLS as GRID_COLS,
  BLOCK_GRID_ROWS as GRID_ROWS,
  BORDER_LENGTH,
  BORDER_THICKNESS,
} from '../gameplay/systems/playfieldLayout';

/** Border 그리드: 상단 가로 셀 수. PLAYFIELD_WIDTH / BORDER_LENGTH. */
export const BORDER_TOP_COLS = 11; // 720 / 64 = 11.25 → 11 (마지막 16px 빔)
/** Border 그리드: 좌/우 세로 셀 수. PLAYFIELD_HEIGHT / BORDER_LENGTH. */
export const BORDER_SIDE_ROWS = 11;

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

export type StageBorderPlacementJson = {
  row: number;
  col: number;
  orientation: BorderOrientation;
};

export type StageDoorPlacementJson = {
  col: number;
  spinnerDefinitionId: string;
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
  borders?: StageBorderPlacementJson[];
  doors?: StageDoorPlacementJson[];
  spinners?: StageSpinnerPlacementJson[];
};
