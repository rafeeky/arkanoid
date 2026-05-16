/**
 * canvasLayout.ts — 캔버스 / 플레이필드 레이아웃 상수.
 *
 * **베이스 캔버스: FHD 1080×1920 (16:9)** — 모바일 게임 업계 표준.
 * 19.5:9 / 20:9 기기에서는 Phaser scale=FIT 가 위/아래 letterbox 로 처리.
 *
 * - 캔버스 1080×1920 안에 720×720 종회 플레이필드를 배치
 * - 캔버스 가로 가운데 정렬: 좌우 여백 180px
 * - 캔버스 세로: 위 HUD(220px) + 플레이필드(720px) + 아래 영역(980px)
 *
 * 게임플레이 좌표(블록·바·공·아이템)는 모두 플레이필드 로컬 0..720 기준이다.
 * 메인 카메라를 (−PLAYFIELD_OFFSET_X, −PLAYFIELD_OFFSET_Y) 로 스크롤하여,
 * 기존 720×720 좌표계를 그대로 유지하면서 화면상 플레이필드 영역에 표시한다.
 *
 * Unity 매핑: CanvasScaler Scale With Screen Size + ReferenceResolution(1080, 1920) +
 * Screen Match Mode = Expand. 플레이필드 RectTransform anchor 가 동일한 offset.
 */

// LayoutConfigTable 이 단일 진실 (docs/screen-layout.md §4-1). 이 모듈은
// 기존 import 경로 호환용 re-export. 값 수정은 LayoutConfigTable.ts 에서만.

import { LayoutConfigTable as L } from '../../definitions/tables/LayoutConfigTable';

/** 캔버스 (Phaser game) 가로/세로. */
export const CANVAS_WIDTH = L.canvas.width;
export const CANVAS_HEIGHT = L.canvas.height;

/** 플레이필드 가로/세로. */
export const PLAYFIELD_WIDTH = L.playfield.width;
export const PLAYFIELD_HEIGHT = L.playfield.height;

/** 캔버스 내부 플레이필드 좌상단 오프셋 (캔버스 좌표계). */
export const PLAYFIELD_OFFSET_X = L.playfield.offsetX;
export const PLAYFIELD_OFFSET_Y = L.playfield.offsetY;

/** 위쪽 HUD 영역 높이 (HIGH SCORE / SCORE / ROUND 등). */
export const TOP_HUD_HEIGHT = L.playfield.offsetY;

/** 아래 영역 높이 (라이프 표시 + 추가 UI 자리). */
export const BOTTOM_AREA_HEIGHT = L.canvas.height - L.playfield.offsetY - L.playfield.height;
