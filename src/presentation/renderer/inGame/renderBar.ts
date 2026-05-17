import type Phaser from 'phaser';
import type { BarState } from '../../../gameplay/state/BarState';
import type { BarEffectKind } from '../../../gameplay/events/gameplayEvents';
import { BAR_HEIGHT } from '../../../gameplay/systems/playfieldLayout';

// 바 스프라이트 키 — activeEffect 별 테이블 매핑 (OCP: 새 효과 추가 시 한 곳만 갱신).
const BAR_TEX_BY_EFFECT: Record<BarEffectKind, string> = {
  none:   'bar_normal',
  expand: 'bar_expand_tint',
  magnet: 'bar_magnet_tint',
  laser:  'bar_laser_tint',
};

export type BarObjects = {
  bar: Phaser.GameObjects.Image;
};

export function createBarObjects(scene: Phaser.Scene): BarObjects {
  const bar = scene.add
    .image(360, 680, BAR_TEX_BY_EFFECT.none)
    .setDisplaySize(120, BAR_HEIGHT)
    .setVisible(false);
  return { bar };
}

export function renderBar(
  objects: BarObjects,
  bar: Readonly<BarState>,
  alphaOverride: number,
  isBreaking: boolean,
  breakProgress: number,
): void {
  objects.bar.setTexture(BAR_TEX_BY_EFFECT[bar.activeEffect]);

  if (isBreaking) {
    const alpha = breakProgress;                  // 1.0 → 0.0
    const scaleX = 0.5 + breakProgress * 0.5;     // 1.0 → 0.5
    objects.bar
      .setPosition(bar.x, bar.y)
      .setDisplaySize(bar.width * scaleX, BAR_HEIGHT)
      .setAlpha(alpha * alphaOverride)
      .setVisible(true);
  } else {
    objects.bar
      .setPosition(bar.x, bar.y)
      .setDisplaySize(bar.width, BAR_HEIGHT)
      .setAlpha(alphaOverride)
      .setVisible(true);
  }
}

export function hideBar(objects: BarObjects): void {
  objects.bar.setVisible(false);
}
