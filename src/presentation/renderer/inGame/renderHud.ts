import type Phaser from 'phaser';
import type { HudViewModel } from '../../view-models/HudViewModel';
import { LayoutConfigTable } from '../../../definitions/tables/LayoutConfigTable';

// HUD 상수 — LayoutConfigTable SSOT.
const HUD_TOP_LABEL_Y = LayoutConfigTable.hud.labelY;
const HUD_TOP_VALUE_Y = LayoutConfigTable.hud.valueY;
const HUD_LEFT_X = LayoutConfigTable.hud.leftX;
const HUD_CENTER_X = LayoutConfigTable.hud.centerX;
const HUD_RIGHT_X = LayoutConfigTable.hud.rightX;
const HUD_LABEL_FONT = `${LayoutConfigTable.hud.labelFontPx}px`;
const HUD_VALUE_FONT = `${LayoutConfigTable.hud.valueFontPx}px`;

// 플레이필드 경계 — 시각 장식.
const PLAYFIELD_BORDER_THICKNESS = 6;
const PLAYFIELD_BORDER_COLOR = 0x666666;

// 라이프 — 픽셀아트 하트.
const LIVES_X_START_CANVAS = LayoutConfigTable.livesBar.startX;
const LIVES_Y_CANVAS = LayoutConfigTable.livesBar.y;
const LIVES_GAP = 14;
const HEART_PIXEL = 6;
const HEART_W = 7 * HEART_PIXEL;
const HEART_H = 6 * HEART_PIXEL;
const HEART_COLOR = 0xff3344;
const HEART_PATTERN: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
];

function drawHeart(gfx: Phaser.GameObjects.Graphics, x: number, y: number): void {
  gfx.fillStyle(HEART_COLOR, 1);
  for (let row = 0; row < HEART_PATTERN.length; row++) {
    const pat = HEART_PATTERN[row]!;
    for (let col = 0; col < pat.length; col++) {
      if (pat[col]) {
        gfx.fillRect(x + col * HEART_PIXEL, y + row * HEART_PIXEL, HEART_PIXEL, HEART_PIXEL);
      }
    }
  }
}

export type HudObjects = {
  scoreLabel: Phaser.GameObjects.Text;
  scoreValue: Phaser.GameObjects.Text;
  highScoreLabel: Phaser.GameObjects.Text;
  highScoreValue: Phaser.GameObjects.Text;
  roundLabel: Phaser.GameObjects.Text;
  roundValue: Phaser.GameObjects.Text;
  livesGraphics: Phaser.GameObjects.Graphics;
  borderTop: Phaser.GameObjects.Rectangle;
  borderLeft: Phaser.GameObjects.Rectangle;
  borderRight: Phaser.GameObjects.Rectangle;
  hudEffectTimer: Phaser.GameObjects.Text;
};

export function createHudObjects(scene: Phaser.Scene): HudObjects {
  const scoreLabel = scene.add
    .text(HUD_LEFT_X, HUD_TOP_LABEL_Y, 'SCORE', {
      fontSize: HUD_LABEL_FONT, color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0, 0).setScrollFactor(0).setVisible(false);
  const scoreValue = scene.add
    .text(HUD_LEFT_X, HUD_TOP_VALUE_Y, '0', {
      fontSize: HUD_VALUE_FONT, color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0, 0).setScrollFactor(0).setVisible(false);

  const highScoreLabel = scene.add
    .text(HUD_CENTER_X, HUD_TOP_LABEL_Y, 'HIGH SCORE', {
      fontSize: HUD_LABEL_FONT, color: '#ff3333', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0).setScrollFactor(0).setVisible(false);
  const highScoreValue = scene.add
    .text(HUD_CENTER_X, HUD_TOP_VALUE_Y, '0', {
      fontSize: HUD_VALUE_FONT, color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(0.5, 0).setScrollFactor(0).setVisible(false);

  const roundLabel = scene.add
    .text(HUD_RIGHT_X, HUD_TOP_LABEL_Y, 'ROUND', {
      fontSize: HUD_LABEL_FONT, color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(1, 0).setScrollFactor(0).setVisible(false);
  const roundValue = scene.add
    .text(HUD_RIGHT_X, HUD_TOP_VALUE_Y, '1', {
      fontSize: HUD_VALUE_FONT, color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace',
    })
    .setOrigin(1, 0).setScrollFactor(0).setVisible(false);

  const borderTop = scene.add
    .rectangle(360, -PLAYFIELD_BORDER_THICKNESS / 2,
               720 + PLAYFIELD_BORDER_THICKNESS * 2, PLAYFIELD_BORDER_THICKNESS, PLAYFIELD_BORDER_COLOR)
    .setOrigin(0.5, 0.5).setVisible(false);
  const borderLeft = scene.add
    .rectangle(-PLAYFIELD_BORDER_THICKNESS / 2, 360,
               PLAYFIELD_BORDER_THICKNESS, 720, PLAYFIELD_BORDER_COLOR)
    .setOrigin(0.5, 0.5).setVisible(false);
  const borderRight = scene.add
    .rectangle(720 + PLAYFIELD_BORDER_THICKNESS / 2, 360,
               PLAYFIELD_BORDER_THICKNESS, 720, PLAYFIELD_BORDER_COLOR)
    .setOrigin(0.5, 0.5).setVisible(false);

  const livesGraphics = scene.add.graphics().setScrollFactor(0).setVisible(false);

  const hudEffectTimer = scene.add
    .text(360, 648, '', { fontSize: '14px', color: '#88ccff', fontFamily: 'DNFBitBitv2, monospace' })
    .setOrigin(0.5, 1).setVisible(false);

  return {
    scoreLabel, scoreValue, highScoreLabel, highScoreValue, roundLabel, roundValue,
    livesGraphics, borderTop, borderLeft, borderRight, hudEffectTimer,
  };
}

export function renderHud(objects: HudObjects, hud: HudViewModel): void {
  objects.scoreLabel.setVisible(true);
  objects.scoreValue.setText(String(hud.score)).setVisible(true);
  objects.highScoreLabel.setVisible(true);
  objects.highScoreValue.setText(String(hud.highScore)).setVisible(true);
  objects.roundLabel.setVisible(true);
  objects.roundValue.setText(String(hud.round)).setVisible(true);

  objects.borderTop.setVisible(true);
  objects.borderLeft.setVisible(true);
  objects.borderRight.setVisible(true);

  // 라이프 픽셀하트.
  objects.livesGraphics.clear().setVisible(true);
  const heartY = LIVES_Y_CANVAS - HEART_H / 2;
  for (let i = 0; i < hud.lives; i++) {
    const hx = LIVES_X_START_CANVAS + i * (HEART_W + LIVES_GAP);
    drawHeart(objects.livesGraphics, hx, heartY);
  }

  // 효과 타이머 (magnet/laser).
  if (hud.activeEffect === 'magnet' && hud.magnetRemainingMs > 0) {
    const seconds = (hud.magnetRemainingMs / 1000).toFixed(1);
    objects.hudEffectTimer.setText(`MAGNET ${seconds}s`).setColor('#88ccff').setVisible(true);
  } else if (hud.activeEffect === 'laser') {
    const cdSeconds = (hud.laserCooldownMs / 1000).toFixed(1);
    const laserText = hud.laserCooldownMs > 0 ? `LASER CD ${cdSeconds}s` : 'LASER READY';
    objects.hudEffectTimer.setText(laserText).setColor('#ff8888').setVisible(true);
  } else {
    objects.hudEffectTimer.setVisible(false);
  }
}

export function hideHud(objects: HudObjects): void {
  objects.scoreLabel.setVisible(false);
  objects.scoreValue.setVisible(false);
  objects.highScoreLabel.setVisible(false);
  objects.highScoreValue.setVisible(false);
  objects.roundLabel.setVisible(false);
  objects.roundValue.setVisible(false);
  objects.borderTop.setVisible(false);
  objects.borderLeft.setVisible(false);
  objects.borderRight.setVisible(false);
  objects.livesGraphics.clear().setVisible(false);
  objects.hudEffectTimer.setVisible(false);
}
