import type Phaser from 'phaser';
import type { BarState } from '../../../gameplay/state/BarState';
import type { BarEffectKind } from '../../../gameplay/events/gameplayEvents';
import { BAR_HEIGHT } from '../../../gameplay/systems/playfieldLayout';
import { applyGlossyStyle } from '../../ui/GlossyStyle';

/**
 * 바 — 게임 월드 객체 (diegetic). GlossyStyle 헬퍼로 그림.
 * activeEffect 별 *톤 색* 3쌍 (base/highlight/outline) 매핑.
 *
 * 옛 PNG 자산 (bar_normal/bar_expand_tint/...) 사용 안 함 — 자산 dependency 제거.
 * 미래 톤 변경 시 BAR_COLORS 만 갱신.
 */
const BAR_COLORS: Record<BarEffectKind, { base: number; highlight: number; outline: number }> = {
  none:   { base: 0x556677, highlight: 0xbbccdd, outline: 0x1a2530 },
  expand: { base: 0xb88844, highlight: 0xffddaa, outline: 0x4a2f15 },
  magnet: { base: 0x3a5fb8, highlight: 0xaaccff, outline: 0x122244 },
  laser:  { base: 0xb83a4a, highlight: 0xffaaaa, outline: 0x4a121c },
};

export type BarObjects = {
  /** 바 본체 — Graphics 한 객체로 모든 레이어 (shadow/base/highlight/outline) 묶음. */
  graphics: Phaser.GameObjects.Graphics;
};

export function createBarObjects(scene: Phaser.Scene): BarObjects {
  return {
    graphics: scene.add.graphics().setVisible(false),
  };
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
    w = bar.width * (0.5 + breakProgress * 0.5);  // 1.0 → 0.5
    alpha = breakProgress * alphaOverride;        // 1.0 → 0.0
  }

  applyGlossyStyle(objects.graphics, {
    cx: bar.x,
    cy: bar.y,
    w,
    h: BAR_HEIGHT,
    shape: 'pill',
    baseColor: colors.base,
    highlight: colors.highlight,
    outline: colors.outline,
  });
  objects.graphics.setAlpha(alpha).setVisible(true);
}

export function hideBar(objects: BarObjects): void {
  objects.graphics.setVisible(false);
}
