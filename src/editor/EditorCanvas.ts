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
} from './editorTypes';

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

    // 배경 클리어
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this.drawGrid(state);
    this.drawSpinners(state);
    this.drawCursor(state);
  }

  private drawGrid(state: Readonly<EditorState>): void {
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
        const placement = state.blocks.find(
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

  private drawSpinners(state: Readonly<EditorState>): void {
    const { ctx } = this;

    for (const spinner of state.spinners) {
      const color = SPINNER_COLORS[spinner.definitionId] ?? '#00ffaa';
      const isSelected = spinner.id === state.selectedSpinnerId;

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
    if (!state.isSpinnerPlacementMode) return;

    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // 스피너 배치 모드 안내 텍스트
    ctx.fillStyle = '#ffff00cc';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label =
      state.selectedSpinnerType === 'spinner_cube'
        ? '[cube 배치 모드] 클릭해서 스피너 배치'
        : '[triangle 배치 모드] 클릭해서 스피너 배치';
    ctx.fillText(label, CANVAS_W / 2, CANVAS_H - 30);

    ctx.restore();
  }
}
