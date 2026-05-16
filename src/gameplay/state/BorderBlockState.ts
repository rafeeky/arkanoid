/**
 * BorderBlockState — 플레이필드 테두리(좌/우/상단) 한 셀.
 *
 * 좌표 규약: (x, y) 는 좌상단 (BlockState 와 동일).
 *
 * orientation:
 *   - 'horizontal' = 가로 BORDER_LENGTH × 세로 BORDER_THICKNESS (상단 테두리용)
 *   - 'vertical'   = 가로 BORDER_THICKNESS × 세로 BORDER_LENGTH (좌/우 테두리용)
 *
 * 깨지지 않는 벽. 공이 부딪히면 반사만 일어남 (HP 개념 없음).
 */
export type BorderOrientation = 'horizontal' | 'vertical';

export type BorderBlockState = {
  id: string;
  x: number;
  y: number;
  orientation: BorderOrientation;
};
