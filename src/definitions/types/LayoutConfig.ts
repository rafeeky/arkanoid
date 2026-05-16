/**
 * LayoutConfig — 캔버스 영역 단일 진실 (docs/screen-layout.md 참조).
 *
 * 화면 구성(HUD/플레이필드/마스코트/하단 영역) 의 좌표/크기 데이터.
 * 현재는 코드 const 였던 값들을 데이터로 노출.
 *
 * Unity 매핑: ScriptableObject (LayoutConfigSO) 하나로 대응. CanvasScaler +
 *             RectTransform anchor 가 같은 정보를 다른 형태로 표현.
 */

/** 캔버스 (Phaser game) 크기. */
export type CanvasRegion = {
  width: number;
  height: number;
};

/** 플레이필드 — 게임 좌표계 (0..width, 0..height). 캔버스 안 (offsetX, offsetY) 에 배치. */
export type PlayfieldRegion = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

/** 위 HUD 영역 (SCORE / HIGH SCORE / ROUND 행). 캔버스 좌표계. */
export type HudLayout = {
  /** 라벨 행 y (캔버스 좌표). */
  labelY: number;
  /** 값 행 y. */
  valueY: number;
  /** 좌측 SCORE x. */
  leftX: number;
  /** 중앙 HIGH SCORE x. */
  centerX: number;
  /** 우측 ROUND x. */
  rightX: number;
  /** 라벨 폰트 px. */
  labelFontPx: number;
  /** 값 폰트 px. */
  valueFontPx: number;
};

/** 마스코트 표시 영역 (캔버스 좌표). 중심 + 크기. */
export type MascotRegion = {
  centerX: number;
  centerY: number;
  size: number;
};

/** Lives bar 영역 (캔버스 좌표). */
export type LivesBarRegion = {
  startX: number;
  y: number;
  scale: number;
  gap: number;
  maxDisplay: number;
};

/**
 * 게임바를 조작하는 하단 슬라이더 (모바일/마우스 드래그용).
 * 캔버스 좌표계. trackCenterX 는 보통 canvas.width / 2.
 */
export type BarSliderRegion = {
  centerY: number;
  trackHalfWidth: number;
  trackHeight: number;
  knobRadius: number;
};

export type LayoutConfig = {
  canvas: CanvasRegion;
  playfield: PlayfieldRegion;
  hud: HudLayout;
  mascot: MascotRegion;
  livesBar: LivesBarRegion;
  barSlider: BarSliderRegion;
};
