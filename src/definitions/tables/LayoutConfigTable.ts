import type { LayoutConfig } from '../types/LayoutConfig';

/**
 * 현재 코드 const 값을 그대로 옮긴 기본값.
 *   - canvasLayout.ts (CANVAS_WIDTH/HEIGHT, PLAYFIELD_*, *_OFFSET_*)
 *   - renderInGameScreen.ts (HUD_*_X, HUD_*_Y, CHEER_MASCOT_*, LIVES_BAR_*)
 *
 * 디자이너가 화면 영역 튜닝 시 이 파일만 수정. consumer 들은 LayoutConfigTable
 * 만 읽음 (코드 const 사용 금지).
 *
 * Unity 매핑: LayoutConfigSO ScriptableObject 의 default values.
 */
export const LayoutConfigTable: LayoutConfig = {
  canvas: {
    width: 1080,
    height: 1920,
  },
  // 2026-05-16: playfield height 720→900 (옵션 iii, docs/screen-layout.md §3-2).
  // 늘어난 아래 영역(y=720~900)에 bar(게임바) 가 배치되어 모바일 한 손 조작 친화.
  // 블록 그리드는 위쪽 8행에 그대로 유지.
  playfield: {
    width: 720,
    height: 900,
    offsetX: 180,
    offsetY: 600,
  },
  // 2026-05-17 (ENVELOP 세이프 존): HUD 를 캔버스 가장자리에서 80px 안쪽으로.
  // ENVELOP 모드는 종횡비가 다른 폰에서 가장자리가 잘릴 수 있어 60~80px 세이프 존 필수.
  //   SCORE     leftX=80   (origin 0,0)
  //   HIGH SCORE centerX=360 (origin 0.5,0)
  //   ROUND     rightX=660  (origin 1,0; 우측 여백 420 — 안전)
  //   labelY=100 / valueY=170 — 상단 80px 안쪽
  hud: {
    labelY: 100,
    valueY: 170,
    leftX: 80,
    centerX: 360,
    rightX: 660,
    labelFontPx: 36,
    valueFontPx: 52,
  },
  // 2026-05-17 (재배치): 우측 상단. size=200, centerX=900 → 우측 여백 80.
  //   centerY=200 → 상단 여백 100 (200 - 100 size/2 = 100, 안쪽 80 안전).
  mascot: {
    centerX: 900,
    centerY: 200,
    size: 200,
  },
  // 좌하단. startX=80 (좌 여백 80), y=1700 (하단 여백 220 — 슬라이더와 겹치지 않음).
  livesBar: {
    startX: 80,
    y: 1700,
    scale: 0.4,
    gap: 12,
    maxDisplay: 7,
  },
  // 2026-05-17 (세이프 존 적용): 모바일 한 손 엄지 조작용. centerY=1800 (노브 r=40 → bottom=1840, 하단 80 안쪽).
  // 가로 트랙 trackHalfWidth=400 (중심 540 → 좌우 [140..940], 좌우 여백 140 — 안전).
  // 터치/마우스로 트랙을 누르면 바가 그 위치(playfield 좌표 변환) 로 즉시 스냅.
  barSlider: {
    centerY: 1800,
    trackHalfWidth: 400,
    trackHeight: 20,
    knobRadius: 40,
  },
};
