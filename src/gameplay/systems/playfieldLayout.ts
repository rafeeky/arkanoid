/**
 * playfieldLayout.ts — 플레이필드 좌표계의 단일 진실 소스 (single source of truth).
 *
 * 게임 런타임 (StageRuntimeFactory, MovementSystem, CollisionService 등) 과
 * 편집기 (`src/editor/`) 가 *모두* 이 파일에서 import 한다.
 *
 * - 좌표계: 플레이필드 로컬 (0..720, 0..720). 게임 캔버스(1080×1920)와는 별개.
 *   메인 카메라가 zoom 1.5 + centerOn 으로 화면 표시.
 * - 게임 룰 좌표 (블록·바·공·스피너) 는 모두 이 좌표계 기준.
 *
 * 추가 / 수정 시 양쪽이 자동 동기화 — 별도 작업 불필요.
 */

// ─── 플레이필드 (논리 좌표계) ────────────────────────────────────────────
// LayoutConfigTable 이 SSOT (docs/screen-layout.md §4-1). 게임플레이 로직과
// 프레젠테이션이 같은 값을 공유.
import { LayoutConfigTable as _L } from '../../definitions/tables/LayoutConfigTable';
export const PLAYFIELD_WIDTH = _L.playfield.width;
export const PLAYFIELD_HEIGHT = _L.playfield.height;

// ─── 블록 그리드 ──────────────────────────────────────────────────────
export const BLOCK_WIDTH = 64;
export const BLOCK_HEIGHT = 24;
export const BLOCK_GAP = 4;
export const BLOCK_GRID_LEFT_MARGIN = 56;
export const BLOCK_GRID_START_Y = 80;
/** 편집기 그리드 가로 셀 수. 게임은 stage 데이터에 따름이지만 편집기 UI 제약. */
export const BLOCK_GRID_COLS = 9;
/** 편집기 그리드 세로 셀 수. */
export const BLOCK_GRID_ROWS = 7;

// ─── 바 / 공 ───────────────────────────────────────────────────────────
export const BAR_HEIGHT = 16;
export const BALL_RADIUS = 8;
/** 발사 각도 -60° 와 시각 일치 — 비활성 공이 바 중심에서 우측 30px 위에 위치. */
export const INITIAL_LAUNCH_OFFSET_X = 30;

// ─── 아이템 드랍 ─────────────────────────────────────────────────────
// 2026-05-18: 블록과 동일 사이즈 (64×24). 블록 = 아이템 블록 일치 + 충돌 판정도 같음.
export const ITEM_WIDTH = 64;   // = BLOCK_WIDTH
export const ITEM_HEIGHT = 24;  // = BLOCK_HEIGHT

// ─── 테두리 (BorderBlock) ──────────────────────────────────────────────
/**
 * 테두리 한 셀이 차지하는 길이. 720 (PLAYFIELD 폭/높이) 의 약수여야 끝이 빔 없이 맞음.
 * 720 / 60 = 12 셀.
 * (이전 64 는 720/64 = 11.25 라 마지막 16px 빔 발생.)
 */
export const BORDER_LENGTH = 60;
/** 테두리의 짧은 변 (= 일반 블럭 세로의 1/2). 두께. */
export const BORDER_THICKNESS = 12;

// ─── 스피너 궤도 clamp ─────────────────────────────────────────────────
export const CIRCLE_RADIUS = 60;
export const CIRCLE_CLAMP_MARGIN = 10;
export const MIN_CIRCLE_CENTER_Y = 380;
export const BAR_CLEARANCE = 80;

// ─── 헬퍼 함수 (양쪽이 동일하게 호출) ────────────────────────────────
/**
 * 블록 grid (col, row) → 플레이필드 좌표 (블록 좌상단).
 * 편집기 미리보기 / 게임 런타임 둘 다 이 함수로 동일한 위치 계산.
 */
export function blockGridPosition(col: number, row: number): { x: number; y: number } {
  return {
    x: BLOCK_GRID_LEFT_MARGIN + col * (BLOCK_WIDTH + BLOCK_GAP),
    y: BLOCK_GRID_START_Y + row * (BLOCK_HEIGHT + BLOCK_GAP),
  };
}

/**
 * 스피너 placement (spawnX, descentEndY) → 게임이 실제 사용하는 원 궤도 중심.
 * 편집기에서 미리 호출하면 사용자가 배치한 위치와 게임 표시 위치가 어긋나는 것을 방지.
 *
 * Clamp 규칙:
 * - centerX ∈ [CIRCLE_RADIUS + CIRCLE_CLAMP_MARGIN, PLAYFIELD_WIDTH - CIRCLE_RADIUS - CIRCLE_CLAMP_MARGIN]
 * - centerY ∈ [MIN_CIRCLE_CENTER_Y, PLAYFIELD_HEIGHT - CIRCLE_RADIUS - BAR_CLEARANCE]
 */
export function clampSpinnerCenter(spawnX: number, descentEndY: number): { centerX: number; centerY: number } {
  const centerX = clamp(
    spawnX,
    CIRCLE_RADIUS + CIRCLE_CLAMP_MARGIN,
    PLAYFIELD_WIDTH - CIRCLE_RADIUS - CIRCLE_CLAMP_MARGIN,
  );
  const centerY = clamp(
    descentEndY,
    MIN_CIRCLE_CENTER_Y,
    PLAYFIELD_HEIGHT - CIRCLE_RADIUS - BAR_CLEARANCE,
  );
  return { centerX, centerY };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
