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
  // 2026-05-16: HUD 3개(SCORE/HIGH SCORE/ROUND)를 캔버스 좌측 절반(0..720)으로
  // 몰아넣고, 우측(720..1080)을 마스코트 자리로 비웠다.
  //   SCORE     leftX=60   (origin 0,0)
  //   HIGH SCORE centerX=360 (origin 0.5,0)
  //   ROUND     rightX=660  (origin 1,0)
  hud: {
    labelY: 80,
    valueY: 150,
    leftX: 60,
    centerX: 360,
    rightX: 660,
    labelFontPx: 36,
    valueFontPx: 52,
  },
  // 2026-05-16 (재배치): mascot 을 ROUND 가 있던 우측 상단으로. HUD 행과 같은
  // y 대역(80~200)에 정렬되도록 centerY=160. size 200 (캔버스 우측 360px 폭에 여유).
  mascot: {
    centerX: 900,
    centerY: 160,
    size: 200,
  },
  livesBar: {
    startX: 80,
    y: 1700,
    scale: 0.4,
    gap: 12,
    maxDisplay: 7,
  },
  // 모바일 한 손 엄지 조작용. 캔버스 하단 (y=1850), 가로 800px, 노브 r=40.
  // 터치/마우스로 트랙을 누르면 바가 그 위치(playfield 좌표 변환) 로 즉시 스냅.
  barSlider: {
    centerY: 1850,
    trackHalfWidth: 400,
    trackHeight: 20,
    knobRadius: 40,
  },
};
