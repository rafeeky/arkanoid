// src/editor/EditorApp.ts
// 에디터 상태와 로직을 소유하는 클래스.
// Unity 포팅 시 EditorManager (MonoBehaviour) 하나로 매핑.
// 게임 규칙 계산 없음. 오직 편집 상태 관리만 담당.

import type {
  EditorState,
  StageSlotState,
  EditorBlockPlacement,
  EditorSpinnerPlacement,
  BlockTypeId,
  SpinnerTypeId,
  StageJson,
  StageMetadata,
  AllStagesJson,
} from './editorTypes';
import {
  GRID_COLS,
  GRID_ROWS,
  BLOCK_W,
  BLOCK_H,
  BLOCK_GAP,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  CANVAS_W,
} from './editorTypes';

let _spinnerIdCounter = 0;
function nextSpinnerId(): string {
  _spinnerIdCounter += 1;
  return `sp_${_spinnerIdCounter}`;
}

// ─── 스테이지별 기본 메타데이터 ──────────────────────────────────────────────

const STAGE_DEFAULT_METADATA: [StageMetadata, StageMetadata, StageMetadata] = [
  {
    stageId: 'stage_01',
    displayName: 'STAGE 1',
    backgroundId: 'bg_stage_01',
    barSpawnX: 360,
    barSpawnY: 660,
    ballSpawnX: 360,
    ballSpawnY: 600,
    ballInitialSpeed: 588,
    ballInitialAngleDeg: -60,
  },
  {
    stageId: 'stage_02',
    displayName: 'STAGE 2',
    backgroundId: 'bg_stage_02',
    barSpawnX: 360,
    barSpawnY: 660,
    ballSpawnX: 360,
    ballSpawnY: 600,
    ballInitialSpeed: 588,
    ballInitialAngleDeg: -60,
  },
  {
    stageId: 'stage_03',
    displayName: 'STAGE 3',
    backgroundId: 'bg_stage_03',
    barSpawnX: 360,
    barSpawnY: 660,
    ballSpawnX: 360,
    ballSpawnY: 600,
    ballInitialSpeed: 588,
    ballInitialAngleDeg: -60,
  },
];

function makeEmptySlot(idx: 0 | 1 | 2): StageSlotState {
  return {
    metadata: { ...STAGE_DEFAULT_METADATA[idx] },
    blocks: [],
    spinners: [],
  };
}

function makeInitialStages(): [StageSlotState, StageSlotState, StageSlotState] {
  return [makeEmptySlot(0), makeEmptySlot(1), makeEmptySlot(2)];
}

export class EditorApp {
  private state: EditorState;
  private readonly onStateChange: () => void;

  constructor(onStateChange: () => void) {
    this.onStateChange = onStateChange;
    this.state = {
      stages: makeInitialStages(),
      activeStageIndex: 0,
      selectedBlockType: 'basic',
      selectedSpinnerType: null,
      isSpinnerPlacementMode: false,
      selectedSpinnerId: null,
      isDraggingSpinner: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
    };
  }

  // ─── 상태 읽기 ───────────────────────────────────────────────────────────

  getState(): Readonly<EditorState> {
    return this.state;
  }

  getActiveSlot(): Readonly<StageSlotState> {
    return this.state.stages[this.state.activeStageIndex];
  }

  // ─── 탭 전환 ─────────────────────────────────────────────────────────────

  setActiveStageIndex(idx: 0 | 1 | 2): void {
    if (this.state.activeStageIndex === idx) return;
    this.state = {
      ...this.state,
      activeStageIndex: idx,
      // 탭 전환 시 스피너/드래그 모드 초기화
      isSpinnerPlacementMode: false,
      selectedSpinnerType: null,
      selectedSpinnerId: null,
      isDraggingSpinner: false,
    };
    this.onStateChange();
  }

  // ─── 활성 슬롯 패치 헬퍼 ────────────────────────────────────────────────

  private patchActiveSlot(patch: Partial<StageSlotState>): void {
    const idx = this.state.activeStageIndex;
    const updated = this.state.stages.slice() as [
      StageSlotState,
      StageSlotState,
      StageSlotState,
    ];
    updated[idx] = { ...updated[idx], ...patch };
    this.state = { ...this.state, stages: updated };
    this.onStateChange();
  }

  // ─── 팔레트 선택 ─────────────────────────────────────────────────────────

  selectBlockType(type: BlockTypeId): void {
    this.state = {
      ...this.state,
      selectedBlockType: type,
      isSpinnerPlacementMode: false,
      selectedSpinnerType: null,
    };
    this.onStateChange();
  }

  enterSpinnerPlacementMode(type: SpinnerTypeId): void {
    this.state = {
      ...this.state,
      isSpinnerPlacementMode: true,
      selectedSpinnerType: type,
    };
    this.onStateChange();
  }

  exitSpinnerPlacementMode(): void {
    this.state = {
      ...this.state,
      isSpinnerPlacementMode: false,
      selectedSpinnerType: null,
    };
    this.onStateChange();
  }

  // ─── 캔버스 → 그리드 좌표 변환 ─────────────────────────────────────────

  canvasPosToGridCell(
    cx: number,
    cy: number,
  ): { row: number; col: number } | null {
    const col = Math.floor((cx - GRID_OFFSET_X) / (BLOCK_W + BLOCK_GAP));
    const row = Math.floor((cy - GRID_OFFSET_Y) / (BLOCK_H + BLOCK_GAP));
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
      return null;
    }
    return { row, col };
  }

  gridCellToCanvasPos(
    row: number,
    col: number,
  ): { x: number; y: number; w: number; h: number } {
    return {
      x: GRID_OFFSET_X + col * (BLOCK_W + BLOCK_GAP),
      y: GRID_OFFSET_Y + row * (BLOCK_H + BLOCK_GAP),
      w: BLOCK_W,
      h: BLOCK_H,
    };
  }

  // ─── 블록 배치/제거 ──────────────────────────────────────────────────────

  handleCanvasClick(cx: number, cy: number): void {
    if (this.state.isSpinnerPlacementMode) {
      this.placeSpinnerAt(cx, cy);
      return;
    }

    const cell = this.canvasPosToGridCell(cx, cy);
    if (cell === null) return;

    const { row, col } = cell;
    const slot = this.getActiveSlot();

    if (this.state.selectedBlockType === 'empty') {
      this.removeBlock(row, col);
      return;
    }

    const existing = slot.blocks.find((b) => b.row === row && b.col === col);

    if (existing && existing.definitionId === this.state.selectedBlockType) {
      this.removeBlock(row, col);
    } else {
      this.setBlock(row, col, this.state.selectedBlockType);
    }
  }

  private setBlock(row: number, col: number, definitionId: BlockTypeId): void {
    const slot = this.getActiveSlot();
    const filtered = slot.blocks.filter(
      (b) => !(b.row === row && b.col === col),
    );
    const placement: EditorBlockPlacement = { row, col, definitionId };
    this.patchActiveSlot({ blocks: [...filtered, placement] });
  }

  private removeBlock(row: number, col: number): void {
    const slot = this.getActiveSlot();
    const blocks = slot.blocks.filter(
      (b) => !(b.row === row && b.col === col),
    );
    this.patchActiveSlot({ blocks });
  }

  // ─── 스피너 배치/제거/이동 ───────────────────────────────────────────────

  private placeSpinnerAt(cx: number, cy: number): void {
    if (this.state.selectedSpinnerType === null) return;
    const spinner: EditorSpinnerPlacement = {
      id: nextSpinnerId(),
      definitionId: this.state.selectedSpinnerType,
      x: Math.round(cx),
      y: Math.round(cy),
    };
    const slot = this.getActiveSlot();
    this.patchActiveSlot({ spinners: [...slot.spinners, spinner] });
    this.state = {
      ...this.state,
      isSpinnerPlacementMode: false,
      selectedSpinnerType: null,
    };
    this.onStateChange();
  }

  removeSpinner(id: string): void {
    const slot = this.getActiveSlot();
    const spinners = slot.spinners.filter((s) => s.id !== id);
    this.patchActiveSlot({ spinners });
  }

  startDragSpinner(id: string, canvasX: number, canvasY: number): void {
    const slot = this.getActiveSlot();
    const spinner = slot.spinners.find((s) => s.id === id);
    if (spinner === undefined) return;
    this.state = {
      ...this.state,
      selectedSpinnerId: id,
      isDraggingSpinner: true,
      dragOffsetX: canvasX - spinner.x,
      dragOffsetY: canvasY - spinner.y,
    };
  }

  dragSpinner(canvasX: number, canvasY: number): void {
    if (!this.state.isDraggingSpinner || this.state.selectedSpinnerId === null)
      return;
    const id = this.state.selectedSpinnerId;
    const slot = this.getActiveSlot();
    const spinners = slot.spinners.map((s) => {
      if (s.id !== id) return s;
      return {
        ...s,
        x: Math.round(
          Math.min(Math.max(canvasX - this.state.dragOffsetX, 0), CANVAS_W),
        ),
        y: Math.round(
          Math.min(Math.max(canvasY - this.state.dragOffsetY, 0), CANVAS_W),
        ),
      };
    });
    this.patchActiveSlot({ spinners });
  }

  endDragSpinner(): void {
    this.state = {
      ...this.state,
      isDraggingSpinner: false,
      selectedSpinnerId: null,
    };
    this.onStateChange();
  }

  hitTestSpinner(cx: number, cy: number): string | null {
    const RADIUS = 28;
    const slot = this.getActiveSlot();
    for (const s of slot.spinners) {
      const dx = cx - s.x;
      const dy = cy - s.y;
      if (dx * dx + dy * dy <= RADIUS * RADIUS) return s.id;
    }
    return null;
  }

  // ─── 메타데이터 갱신 ─────────────────────────────────────────────────────

  updateMetadata(patch: Partial<StageMetadata>): void {
    const slot = this.getActiveSlot();
    this.patchActiveSlot({ metadata: { ...slot.metadata, ...patch } });
  }

  // ─── Export / Import (현재 스테이지) ────────────────────────────────────

  exportCurrentJson(): string {
    const slot = this.getActiveSlot();
    return slotToJson(slot);
  }

  importCurrentJson(text: string): { ok: true } | { ok: false; error: string } {
    const result = parseStageJson(text);
    if (!result.ok) return result;
    this.patchActiveSlot(jsonToSlot(result.data));
    return { ok: true };
  }

  // ─── Export / Import (전체 스테이지) ────────────────────────────────────

  exportAllJson(): string {
    const all: AllStagesJson = this.state.stages.map((slot) =>
      JSON.parse(slotToJson(slot)) as StageJson,
    );
    return JSON.stringify(all, null, 2);
  }

  importAllJson(text: string): { ok: true } | { ok: false; error: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'JSON 파싱 실패. 형식을 확인하세요.' };
    }

    if (!Array.isArray(parsed)) {
      return { ok: false, error: '배열 형식이 아닙니다. [ {...}, {...}, {...} ] 형식으로 입력하세요.' };
    }

    if (parsed.length !== 3) {
      return { ok: false, error: `3개의 스테이지가 필요합니다. (현재 ${parsed.length}개)` };
    }

    const newStages: [StageSlotState, StageSlotState, StageSlotState] = [
      makeEmptySlot(0),
      makeEmptySlot(1),
      makeEmptySlot(2),
    ];

    for (let i = 0; i < 3; i++) {
      const result = parseStageJsonFromObject(parsed[i]);
      if (!result.ok) {
        return { ok: false, error: `Stage ${i + 1}: ${result.error}` };
      }
      newStages[i] = jsonToSlot(result.data);
    }

    _spinnerIdCounter = 0;
    this.state = { ...this.state, stages: newStages };
    this.onStateChange();
    return { ok: true };
  }

  // ─── Clear ───────────────────────────────────────────────────────────────

  clearCurrentStage(): void {
    const idx = this.state.activeStageIndex;
    this.patchActiveSlot({
      metadata: { ...STAGE_DEFAULT_METADATA[idx] },
      blocks: [],
      spinners: [],
    });
  }

  clearAllStages(): void {
    _spinnerIdCounter = 0;
    this.state = {
      ...this.state,
      stages: makeInitialStages(),
      isSpinnerPlacementMode: false,
      selectedSpinnerType: null,
      selectedSpinnerId: null,
      isDraggingSpinner: false,
    };
    this.onStateChange();
  }
}

// ─── 순수 변환 함수 (내부 헬퍼) ──────────────────────────────────────────────

function slotToJson(slot: Readonly<StageSlotState>): string {
  const { metadata, blocks, spinners } = slot;
  const json: StageJson = {
    ...metadata,
    blocks: blocks
      .sort((a, b) => a.row - b.row || a.col - b.col)
      .map((b) => ({ row: b.row, col: b.col, definitionId: b.definitionId })),
  };
  if (spinners.length > 0) {
    json.spinners = spinners.map((s) => ({
      definitionId: s.definitionId,
      x: s.x,
      y: s.y,
    }));
  }
  return JSON.stringify(json, null, 2);
}

type ParseResult =
  | { ok: true; data: StageJson }
  | { ok: false; error: string };

function parseStageJson(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON 파싱 실패. 형식을 확인하세요.' };
  }
  return parseStageJsonFromObject(parsed);
}

function parseStageJsonFromObject(parsed: unknown): ParseResult {
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: '오브젝트 형식이 아닙니다.' };
  }

  const obj = parsed as Record<string, unknown>;

  const data: StageJson = {
    stageId: typeof obj['stageId'] === 'string' ? obj['stageId'] : 'stage_new',
    displayName:
      typeof obj['displayName'] === 'string' ? obj['displayName'] : 'STAGE',
    backgroundId:
      typeof obj['backgroundId'] === 'string'
        ? obj['backgroundId']
        : 'bg_stage_01',
    barSpawnX: typeof obj['barSpawnX'] === 'number' ? obj['barSpawnX'] : 360,
    barSpawnY: typeof obj['barSpawnY'] === 'number' ? obj['barSpawnY'] : 660,
    ballSpawnX:
      typeof obj['ballSpawnX'] === 'number' ? obj['ballSpawnX'] : 360,
    ballSpawnY:
      typeof obj['ballSpawnY'] === 'number' ? obj['ballSpawnY'] : 600,
    ballInitialSpeed:
      typeof obj['ballInitialSpeed'] === 'number'
        ? obj['ballInitialSpeed']
        : 588,
    ballInitialAngleDeg:
      typeof obj['ballInitialAngleDeg'] === 'number'
        ? obj['ballInitialAngleDeg']
        : -60,
    blocks: [],
  };

  const rawBlocks = Array.isArray(obj['blocks']) ? obj['blocks'] : [];
  data.blocks = rawBlocks
    .filter(
      (b): b is Record<string, unknown> =>
        typeof b === 'object' && b !== null,
    )
    .map((b) => ({
      row: typeof b['row'] === 'number' ? b['row'] : 0,
      col: typeof b['col'] === 'number' ? b['col'] : 0,
      definitionId:
        typeof b['definitionId'] === 'string' ? b['definitionId'] : 'basic',
    }));

  const rawSpinners = Array.isArray(obj['spinners']) ? obj['spinners'] : [];
  if (rawSpinners.length > 0) {
    data.spinners = rawSpinners
      .filter(
        (s): s is Record<string, unknown> =>
          typeof s === 'object' && s !== null,
      )
      .map((s) => ({
        definitionId:
          typeof s['definitionId'] === 'string'
            ? s['definitionId']
            : 'spinner_cube',
        x: typeof s['x'] === 'number' ? s['x'] : 360,
        y: typeof s['y'] === 'number' ? s['y'] : 400,
      }));
  }

  return { ok: true, data };
}

function jsonToSlot(data: StageJson): StageSlotState {
  const { stageId, displayName, backgroundId,
    barSpawnX, barSpawnY, ballSpawnX, ballSpawnY,
    ballInitialSpeed, ballInitialAngleDeg,
    blocks: rawBlocks, spinners: rawSpinners } = data;

  const metadata: StageMetadata = {
    stageId, displayName, backgroundId,
    barSpawnX, barSpawnY, ballSpawnX, ballSpawnY,
    ballInitialSpeed, ballInitialAngleDeg,
  };

  const blocks: EditorBlockPlacement[] = (rawBlocks ?? []).map((b) => ({
    row: b.row,
    col: b.col,
    definitionId: b.definitionId as import('./editorTypes').BlockTypeId,
  }));

  const spinners: EditorSpinnerPlacement[] = (rawSpinners ?? []).map((s) => ({
    id: nextSpinnerId(),
    definitionId: s.definitionId as import('./editorTypes').SpinnerTypeId,
    x: s.x,
    y: s.y,
  }));

  return { metadata, blocks, spinners };
}
