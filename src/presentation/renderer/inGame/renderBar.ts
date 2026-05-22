import type Phaser from 'phaser';
import type { BarState } from '../../../gameplay/state/BarState';
import type { BarEffectKind } from '../../../gameplay/events/gameplayEvents';
import { BAR_HEIGHT } from '../../../gameplay/systems/playfieldLayout';

/**
 * 바 — 분리 디자인: [반원 좌 (semicircle 색)] [흰띠] [사각 (base 색)] [흰띠] [반원 우].
 *
 * 양쪽 반원이 *바 본체에 덧붙은* 느낌. 흰띠 = 반원과 사각 사이 구분선.
 * 옛 applyGlossyStyle (단순 pill) 폐기 — 바 전용 시각.
 *
 * activeEffect 별 색:
 * - none:   회색 사각 + 하늘색 반원
 * - expand: 구리 + 금
 * - magnet: 진파랑 + 파랑 highlight
 * - laser:  진빨강 + 빨강 highlight
 */
const BAR_COLORS: Record<BarEffectKind, { base: number; semicircle: number }> = {
  none:   { base: 0x666666, semicircle: 0x88ccff },
  expand: { base: 0xb88844, semicircle: 0xffddaa },
  magnet: { base: 0x3a5fb8, semicircle: 0xaaccff },
  laser:  { base: 0xb83a4a, semicircle: 0xffaaaa },
};

const STRIP_WIDTH = 4;       // 흰띠 폭 (px)
const SHADOW_OFFSET_Y = 4;
const SHADOW_ALPHA = 0.45;
const STRIP_COLOR = 0xffffff;

export type BarObjects = {
  graphics: Phaser.GameObjects.Graphics;
};

export function createBarObjects(scene: Phaser.Scene): BarObjects {
  return { graphics: scene.add.graphics().setVisible(false) };
}

function drawBar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  w: number,
  h: number,
  colors: { base: number; semicircle: number },
): void {
  g.clear();
  const halfW = w / 2;
  const halfH = h / 2;
  const radius = halfH;
  const left = cx - halfW;
  const top = cy - halfH;

  // 1) drop shadow — 전체 capsule 모양.
  g.fillStyle(0x000000, SHADOW_ALPHA);
  g.fillRoundedRect(left, top + SHADOW_OFFSET_Y, w, h, radius);

  // 2) 좌/우 원 (가운데 사각이 위에 덮어 *반원* 처럼 보임).
  g.fillStyle(colors.semicircle, 1);
  g.fillCircle(left + radius, cy, radius);
  g.fillCircle(left + w - radius, cy, radius);

  // 3) 가운데 사각 — 원의 우측 반쪽을 덮어 반원 분리. 사각만 base 색.
  const rectLeft = left + radius;
  const rectWidth = w - 2 * radius;
  g.fillStyle(colors.base, 1);
  g.fillRect(rectLeft, top, rectWidth, h);

  // 4) 흰띠 — 반원/사각 경계 (양쪽). 사각 fill 위에 덮어 띠로 보임.
  g.fillStyle(STRIP_COLOR, 1);
  g.fillRect(rectLeft, top, STRIP_WIDTH, h);                    // 좌 띠
  g.fillRect(rectLeft + rectWidth - STRIP_WIDTH, top, STRIP_WIDTH, h); // 우 띠
}

export function renderBar(
  objects: BarObjects,
  bar: Readonly<BarState>,
  alphaOverride: number,
  isBreaking: boolean,
  breakProgress: number,
): void {
  const colors = BAR_COLORS[bar.activeEffect];
  let w = bar.width;
  let alpha = alphaOverride;

  if (isBreaking) {
    w = bar.width * (0.5 + breakProgress * 0.5);
    alpha = breakProgress * alphaOverride;
  }

  drawBar(objects.graphics, bar.x, bar.y, w, BAR_HEIGHT, colors);
  objects.graphics.setAlpha(alpha).setVisible(true);
}

export function hideBar(objects: BarObjects): void {
  objects.graphics.setVisible(false);
}
