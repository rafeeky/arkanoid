// src/editor/EditorApp.ts
// 에디터 상태와 로직을 소유하는 클래스.
// Unity 포팅 시 EditorManager (MonoBehaviour) 하나로 매핑.
// 게임 규칙 계산 없음. 오직 편집 상태 관리만 담당.

import type {
  EditorState,
  EditorBlockPlacement,
  EditorSpinnerPlacement,
  BlockTypeId,
  SpinnerTypeId,
  StageJson,
  StageMetadata,
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

const DEFAULT_METADATA: StageMetadata = {
  stageId: 'stage_new',
  displayName: 'NEW STAGE',
  backgroundId: 'bg_stage_01',
  barSpawnX: 360,
  barSpawnY: 660,
  ballSpawnX: 360,
  ballSpawnY: 600,
  ballInitialSpeed: 588,
  ballInitialAngleDeg: -60,
};

export class EditorApp {
  private state: EditorState;
  private readonly onStateChange: () => void;

  constructor(onStateChange: () => void) {
    this.onStateChange = onStateChange;
    this.state = {
      metadata: { ...DEFAULT_METADATA },
      blocks: [],
      spinners: [],
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

    if (this.state.selectedBlockType === 'empty') {
      this.removeBlock(row, col);
      return;
    }

    const existing = this.state.blocks.find(
      (b) => b.row === row && b.col === col,
    );

    if (existing && existing.definitionId === this.state.selectedBlockType) {
      // 같은 타입 토글 → 제거
      this.removeBlock(row, col);
    } else {
      this.setBlock(row, col, this.state.selectedBlockType);
    }
  }

  private setBlock(row: number, col: number, definitionId: BlockTypeId): void {
    const filtered = this.state.blocks.filter(
      (b) => !(b.row === row && b.col === col),
    );
    const placement: EditorBlockPlacement = { row, col, definitionId };
    this.state = { ...this.state, blocks: [...filtered, placement] };
    this.onStateChange();
  }

  private removeBlock(row: number, col: number): void {
    const blocks = this.state.blocks.filter(
      (b) => !(b.row === row && b.col === col),
    );
    this.state = { ...this.state, blocks };
    this.onStateChange();
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
    this.state = {
      ...this.state,
      spinners: [...this.state.spinners, spinner],
      isSpinnerPlacementMode: false,
      selectedSpinnerType: null,
    };
    this.onStateChange();
  }

  removeSpinner(id: string): void {
    const spinners = this.state.spinners.filter((s) => s.id !== id);
    this.state = { ...this.state, spinners };
    this.onStateChange();
  }

  startDragSpinner(id: string, canvasX: number, canvasY: number): void {
    const spinner = this.state.spinners.find((s) => s.id === id);
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
    const spinners = this.state.spinners.map((s) => {
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
    this.state = { ...this.state, spinners };
    this.onStateChange();
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
    for (const s of this.state.spinners) {
      const dx = cx - s.x;
      const dy = cy - s.y;
      if (dx * dx + dy * dy <= RADIUS * RADIUS) return s.id;
    }
    return null;
  }

  // ─── 메타데이터 갱신 ─────────────────────────────────────────────────────

  updateMetadata(patch: Partial<StageMetadata>): void {
    this.state = {
      ...this.state,
      metadata: { ...this.state.metadata, ...patch },
    };
    this.onStateChange();
  }

  // ─── Export / Import ──────────────────────────────────────────────────────

  exportJson(): string {
    const { metadata, blocks, spinners } = this.state;
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

  importJson(text: string): { ok: true } | { ok: false; error: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'JSON 파싱 실패. 형식을 확인하세요.' };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, error: '오브젝트 형식이 아닙니다.' };
    }

    const obj = parsed as Record<string, unknown>;

    const meta: StageMetadata = {
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
    };

    const rawBlocks = Array.isArray(obj['blocks']) ? obj['blocks'] : [];
    const blocks: EditorBlockPlacement[] = rawBlocks
      .filter(
        (b): b is Record<string, unknown> =>
          typeof b === 'object' && b !== null,
      )
      .map((b) => ({
        row: typeof b['row'] === 'number' ? b['row'] : 0,
        col: typeof b['col'] === 'number' ? b['col'] : 0,
        definitionId: (
          typeof b['definitionId'] === 'string' ? b['definitionId'] : 'basic'
        ) as BlockTypeId,
      }));

    const rawSpinners = Array.isArray(obj['spinners']) ? obj['spinners'] : [];
    _spinnerIdCounter = 0;
    const spinners: EditorSpinnerPlacement[] = rawSpinners
      .filter(
        (s): s is Record<string, unknown> =>
          typeof s === 'object' && s !== null,
      )
      .map((s) => ({
        id: nextSpinnerId(),
        definitionId: (
          typeof s['definitionId'] === 'string'
            ? s['definitionId']
            : 'spinner_cube'
        ) as SpinnerTypeId,
        x: typeof s['x'] === 'number' ? s['x'] : 360,
        y: typeof s['y'] === 'number' ? s['y'] : 400,
      }));

    this.state = {
      ...this.state,
      metadata: meta,
      blocks,
      spinners,
    };
    this.onStateChange();
    return { ok: true };
  }

  // ─── 전체 초기화 ─────────────────────────────────────────────────────────

  clearAll(): void {
    _spinnerIdCounter = 0;
    this.state = {
      ...this.state,
      metadata: { ...DEFAULT_METADATA },
      blocks: [],
      spinners: [],
      isSpinnerPlacementMode: false,
      selectedSpinnerType: null,
      selectedSpinnerId: null,
      isDraggingSpinner: false,
    };
    this.onStateChange();
  }
}
