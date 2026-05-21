import type Phaser from 'phaser';

/**
 * GlossyStyle — 게임 월드 (diegetic) 오브젝트의 공유 광택 스타일.
 *
 * 적용 대상: 바, 공, (TODO: 톤 결정 후) 블록.
 * UI 버튼 (non-diegetic) 의 `Button.ts` 와 별개 — 게임 안 물체 vs 세계 외 손잡이는 시각 언어 분리.
 * 자세한 룰: [[learning_principles_albatross]] §4 + §5, diegetic/non-diegetic Voca.
 *
 * 레이어 (블록 자산의 광택 톤 모방):
 *   1) drop shadow (검정, 아래 offset)
 *   2) base fill (톤 색)
 *   3) highlight (위쪽 영역 반투명) — *입체 인식의 핵심* (반사광 위치 = 사람 눈이 입체로 인식)
 *   4) outline (얇은 어두운 stroke)
 *
 * shape 별 highlight 패턴:
 *   - `pill` (바): 위쪽 절반 반투명 띠
 *   - `circle` (공): 좌상단 작은 specular 점
 */

export type GlossyShape = 'pill' | 'circle';

export type GlossyOptions = {
  /** 중심 좌표. */
  cx: number;
  cy: number;
  /** 사이즈 (px). circle 은 w === h 가정 (지름). */
  w: number;
  h: number;
  /** 모양. */
  shape: GlossyShape;
  /** 베이스 색 (16진수). 순백 X — 검정 배경에 떠 보임. 톤 있는 색. */
  baseColor: number;
  /** 위쪽 하이라이트 색 (16진수). 보통 baseColor 의 밝은 톤. */
  highlight: number;
  /** 외곽선 색 (16진수). 검정/어두운 톤 — 배경과 분리. */
  outline: number;
  /** 외곽선 두께. default 2. */
  outlineWidth?: number;
  /** drop shadow 표시 여부. default true. */
  shadow?: boolean;
};

const SHADOW_OFFSET = 4;
const SHADOW_ALPHA = 0.45;
const HIGHLIGHT_ALPHA_PILL = 0.45;
const HIGHLIGHT_ALPHA_CIRCLE = 0.7;
const SPECULAR_RADIUS_RATIO = 0.3;     // circle 반지름 대비 specular 크기
const SPECULAR_OFFSET_RATIO = 0.35;    // circle 반지름 대비 좌상단 offset

/**
 * applyGlossyStyle — 한 Graphics 에 광택 톤 레이어를 그린다. 매 호출 시 graphics.clear() 후 다시 그림.
 *
 * 호출자는 Graphics 의 *위치/visible* 관리. 이 함수는 *그리기* 만.
 */
export function applyGlossyStyle(g: Phaser.GameObjects.Graphics, opt: GlossyOptions): void {
  g.clear();
  const outlineWidth = opt.outlineWidth ?? 2;
  const showShadow = opt.shadow ?? true;

  if (opt.shape === 'pill') {
    drawPill(g, opt, outlineWidth, showShadow);
  } else {
    drawCircle(g, opt, outlineWidth, showShadow);
  }
}

function drawPill(
  g: Phaser.GameObjects.Graphics,
  opt: GlossyOptions,
  outlineWidth: number,
  showShadow: boolean,
): void {
  const halfW = opt.w / 2;
  const halfH = opt.h / 2;
  const cornerR = halfH; // 알약 — 양 끝 반원.
  const left = opt.cx - halfW;
  const top = opt.cy - halfH;

  // 1) drop shadow.
  if (showShadow) {
    g.fillStyle(0x000000, SHADOW_ALPHA);
    g.fillRoundedRect(left, top + SHADOW_OFFSET, opt.w, opt.h, cornerR);
  }
  // 2) base.
  g.fillStyle(opt.baseColor, 1);
  g.fillRoundedRect(left, top, opt.w, opt.h, cornerR);
  // 3) highlight 띠 — 위쪽 절반 (모서리 inset).
  const insetX = 4;
  const insetY = 2;
  const innerR = Math.max(2, cornerR - 2);
  g.fillStyle(opt.highlight, HIGHLIGHT_ALPHA_PILL);
  g.fillRoundedRect(
    left + insetX, top + insetY,
    opt.w - insetX * 2, halfH - insetY,
    { tl: innerR, tr: innerR, bl: 0, br: 0 },
  );
  // 4) outline.
  g.lineStyle(outlineWidth, opt.outline, 1);
  g.strokeRoundedRect(left, top, opt.w, opt.h, cornerR);
}

function drawCircle(
  g: Phaser.GameObjects.Graphics,
  opt: GlossyOptions,
  outlineWidth: number,
  showShadow: boolean,
): void {
  const r = opt.w / 2;

  // 1) drop shadow.
  if (showShadow) {
    g.fillStyle(0x000000, SHADOW_ALPHA);
    g.fillCircle(opt.cx, opt.cy + SHADOW_OFFSET / 2, r);
  }
  // 2) base.
  g.fillStyle(opt.baseColor, 1);
  g.fillCircle(opt.cx, opt.cy, r);
  // 3) specular highlight — 좌상단 작은 점 (구슬 반사광).
  g.fillStyle(opt.highlight, HIGHLIGHT_ALPHA_CIRCLE);
  g.fillCircle(
    opt.cx - r * SPECULAR_OFFSET_RATIO,
    opt.cy - r * SPECULAR_OFFSET_RATIO,
    r * SPECULAR_RADIUS_RATIO,
  );
  // 4) outline.
  g.lineStyle(outlineWidth, opt.outline, 1);
  g.strokeCircle(opt.cx, opt.cy, r);
}
