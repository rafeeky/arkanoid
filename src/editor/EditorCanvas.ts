// src/editor/EditorCanvas.ts
// HTML5 Canvas 렌더러. EditorState(ViewModel 역할)를 받아 그리드를 그린다.
// Unity 포팅 시 EditorCanvasView (MonoBehaviour) 하나로 매핑.
// 엔진 API(Canvas 2D)는 이 파일에만 존재.

import type { EditorState } from './editorTypes';
import {
  GRID_COLS,
  GRID_ROWS,
  BLOCK_W,
  BLOCK_H,
  BLOCK_GAP,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  CANVAS_W,
  CANVAS_H,
  BLOCK_COLORS,
  SPINNER_COLORS,
  BORDER_LENGTH,
  BORDER_THICKNESS,
  BORDER_TOP_COLS,
  BORDER_SIDE_ROWS,
} from './editorTypes';
import { clampSpinnerCenter, CIRCLE_RADIUS } from '../gameplay/systems/playfieldLayout';

export class EditorCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.canvas.style.display = 'block';
    this.canvas.style.background = '#111';
    this.canvas.style.cursor = 'crosshair';
    this.canvas.style.flexShrink = '0';

    const ctx = this.canvas.getContext('2d');
    if (ctx === null) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    container.appendChild(this.canvas);
  }

  getElement(): HTMLCanvasElement {
    return this.canvas;
  }

  // ─── 이벤트 리스너 등록 ──────────────────────────────────────────────────

  onMouseDown(
    handler: (cx: number, cy: number, button: number) => void,
  ): void {
    this.canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      handler(
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY,
        e.button,
      );
    });
  }

  onMouseMove(handler: (cx: number, cy: number) => void): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      handler(
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY,
      );
    });
  }

  onMouseUp(handler: () => void): void {
    this.canvas.addEventListener('mouseup', handler);
    window.addEventListener('mouseup', handler);
  }

  onContextMenu(handler: (cx: number, cy: number) => void): void {
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      handler(
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY,
      );
    });
  }

  // ─── 렌더 ────────────────────────────────────────────────────────────────

  render(state: Readonly<EditorState>): void {
    const { ctx } = this;
    const slot = state.stages[state.activeStageIndex];

    // 배경 클리어
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this.drawStageLabel(state);
    this.drawBorderGrid(state);
    this.drawBorders(slot.borders);
    this.drawDoors(slot.doors);
    this.drawGrid(slot.blocks);
    this.drawSpinners(slot.spinners, state.selectedSpinnerId);
    this.drawCursor(state);
  }

  /**
   * 테두리 셀 그리드 라인 표시 — border/door 모드일 때 강조.
   * 상단(BORDER_TOP_COLS 개 가로 셀) + 좌/우(BORDER_SIDE_ROWS 개 세로 셀) 가이드.
   */
  private drawBorderGrid(state: Readonly<EditorState>): void {
    const { ctx } = this;
    const highlight = state.mode === 'border' || state.mode === 'door';
    ctx.save();
    ctx.strokeStyle = highlight ? '#8899aa' : '#333';
    ctx.lineWidth = 1;
    ctx.setLineDash(highlight ? [] : [2, 3]);
    // 상단
    for (let col = 0; col < BORDER_TOP_COLS; col++) {
      ctx.strokeRect(col * BORDER_LENGTH + 0.5, 0.5, BORDER_LENGTH - 1, BORDER_THICKNESS - 1);
    }
    // 좌/우 — door 모드에선 비활성 (door는 상단만)
    if (state.mode !== 'door') {
      for (let row = 0; row < BORDER_SIDE_ROWS; row++) {
        ctx.strokeRect(0.5, row * BORDER_LENGTH + 0.5, BORDER_THICKNESS - 1, BORDER_LENGTH - 1);
        ctx.strokeRect(
          CANVAS_W - BORDER_THICKNESS + 0.5,
          row * BORDER_LENGTH + 0.5,
          BORDER_THICKNESS - 1,
          BORDER_LENGTH - 1,
        );
      }
    }
    ctx.restore();
  }

  private drawBorders(borders: Readonly<EditorState['stages'][0]['borders']>): void {
    const { ctx } = this;
    for (const b of borders) {
      const w = b.orientation === 'horizontal' ? BORDER_LENGTH : BORDER_THICKNESS;
      const h = b.orientation === 'horizontal' ? BORDER_THICKNESS : BORDER_LENGTH;
      let x: number;
      let y: number;
      if (b.orientation === 'horizontal') {
        x = b.col * BORDER_LENGTH;
        y = b.row * BORDER_THICKNESS;
      } else {
        x = b.col === 0 ? 0 : CANVAS_W - BORDER_THICKNESS;
        y = b.row * BORDER_LENGTH;
      }
      ctx.fillStyle = '#555566';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#8899aa';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  }

  private drawDoors(doors: Readonly<EditorState['stages'][0]['doors']>): void {
    const { ctx } = this;
    for (const d of doors) {
      const x = d.col * BORDER_LENGTH;
      const y = 0;
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(x, y, BORDER_LENGTH, BORDER_THICKNESS);
      ctx.strokeStyle = '#ddaa44';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, BORDER_LENGTH - 2, BORDER_THICKNESS - 2);
      // spinner kind 표기 (cube=C / triangle=T)
      ctx.fillStyle = '#ffe0a0';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const letter = d.spinnerDefinitionId === 'spinner_cube' ? 'C' : 'T';
      ctx.fillText(letter, x + BORDER_LENGTH / 2, y + BORDER_THICKNESS / 2);
    }
  }

  private drawStageLabel(state: Readonly<EditorState>): void {
    const { ctx } = this;
    const idx = state.activeStageIndex;
    const label = `STAGE ${idx + 1}`;
    ctx.save();
    ctx.fillStyle = '#444';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(label, CANVAS_W - 8, 4);
    ctx.restore();
  }

  private drawGrid(blocks: Readonly<EditorState['stages'][0]['blocks']>): void {
    const { ctx } = this;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = GRID_OFFSET_X + col * (BLOCK_W + BLOCK_GAP);
        const y = GRID_OFFSET_Y + row * (BLOCK_H + BLOCK_GAP);

        // 셀 경계 (빈 셀)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, BLOCK_W - 1, BLOCK_H - 1);

        // 배치된 블록
        const placement = blocks.find(
          (b) => b.row === row && b.col === col,
        );
        if (placement === undefined) continue;

        const color = BLOCK_COLORS[placement.definitionId] ?? '#888888';
        ctx.fillStyle = color;
        ctx.fillRect(x, y, BLOCK_W, BLOCK_H);

        // 블록 내 텍스트 (definitionId 축약)
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          placement.definitionId.replace('_drop', ''),
          x + BLOCK_W / 2,
          y + BLOCK_H / 2,
        );

        // tough 블록 표시 (이중 테두리)
        if (placement.definitionId === 'tough') {
          ctx.strokeStyle = '#aaa';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, BLOCK_W - 4, BLOCK_H - 4);
        }

        // 드랍 블록 표시 (우하단 점)
        if (placement.definitionId.endsWith('_drop')) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x + BLOCK_W - 6, y + BLOCK_H - 5, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 그리드 외각 테두리
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      GRID_OFFSET_X - 1,
      GRID_OFFSET_Y - 1,
      GRID_COLS * (BLOCK_W + BLOCK_GAP) - BLOCK_GAP + 2,
      GRID_ROWS * (BLOCK_H + BLOCK_GAP) - BLOCK_GAP + 2,
    );
  }

  private drawSpinners(
    spinners: Readonly<EditorState['stages'][0]['spinners']>,
    selectedSpinnerId: string | null,
  ): void {
    const { ctx } = this;

    for (const spinner of spinners) {
      const color = SPINNER_COLORS[spinner.definitionId] ?? '#00ffaa';
      const isSelected = spinner.id === selectedSpinnerId;

      // 게임 런타임이 적용할 원 궤도 중심 미리보기 — 입력 위치와 다르면 ghost circle + 점선.
      const { centerX: clampedX, centerY: clampedY } = clampSpinnerCenter(spinner.x, spinner.y);
      const isClamped = clampedX !== spinner.x || clampedY !== spinner.y;
      if (isClamped) {
        ctx.save();
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(spinner.x, spinner.y);
        ctx.lineTo(clampedX, clampedY);
        ctx.stroke();
        // ghost circle at clamped position (게임이 실제 그릴 궤도 중심)
        ctx.setLineDash([]);
        ctx.strokeStyle = '#ff8800aa';
        ctx.beginPath();
        ctx.arc(clampedX, clampedY, CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(spinner.x, spinner.y);

      if (spinner.definitionId === 'spinner_cube') {
        const half = 20;
        ctx.fillStyle = color + '55'; // 반투명
        ctx.fillRect(-half, -half, half * 2, half * 2);
        ctx.strokeStyle = isSelected ? '#fff' : color;
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.strokeRect(-half, -half, half * 2, half * 2);
      } else {
        // spinner_triangle
        const size = 22;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.866, size * 0.5);
        ctx.lineTo(-size * 0.866, size * 0.5);
        ctx.closePath();
        ctx.fillStyle = color + '55';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#fff' : color;
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.stroke();
      }

      // 라벨
      ctx.fillStyle = isSelected ? '#fff' : color;
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        spinner.definitionId === 'spinner_cube' ? 'cube' : 'tri',
        0,
        26,
      );

      // 좌표 표시
      ctx.fillStyle = '#aaa';
      ctx.font = '8px monospace';
      ctx.fillText(`${spinner.x},${spinner.y}`, 0, 37);

      ctx.restore();
    }
  }

  private drawCursor(state: Readonly<EditorState>): void {
    const { ctx } = this;
    let label: string | null = null;
    if (state.mode === 'spinner') {
      label = state.selectedSpinnerType === 'spinner_cube'
        ? '[cube 배치 모드] 캔버스 안 임의 위치 클릭'
        : '[triangle 배치 모드] 캔버스 안 임의 위치 클릭';
    } else if (state.mode === 'border') {
      label = state.selectedBorderOrientation === 'horizontal'
        ? '[테두리 (가로/상단) 배치] 상단 라인 클릭. 같은 곳 재클릭 = 제거'
        : '[테두리 (세로/좌·우) 배치] 좌/우 라인 클릭. 같은 곳 재클릭 = 제거';
    } else if (state.mode === 'door') {
      const kind = state.selectedDoorSpinner === 'spinner_cube' ? 'cube' : 'triangle';
      label = `[문 배치 — ${kind} 스폰] 상단 라인 클릭. 같은 곳 재클릭 = 제거`;
    }
    if (label === null) return;

    ctx.save();
    ctx.fillStyle = '#ffff00cc';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, CANVAS_W / 2, CANVAS_H - 30);
    ctx.restore();
  }
}
