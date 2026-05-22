import type Phaser from 'phaser';
import type { HudViewModel } from '../../view-models/HudViewModel';
import { LayoutConfigTable } from '../../../definitions/tables/LayoutConfigTable';
import { createButton, type Button } from '../../ui/Button';
import { POWERUP_TABLE, colorToHex } from '../../../definitions/tables/PowerupTable';

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
  borderBottom: Phaser.GameObjects.Rectangle;
  borderLeft: Phaser.GameObjects.Rectangle;
  borderRight: Phaser.GameObjects.Rectangle;
  hudEffectTimer: Phaser.GameObjects.Text;
  /** 우상단 일시정지 버튼 — ESC 와 동일 동작. 공용 Button 컴포넌트. */
  pauseButton: Button;
};

// 일시정지 버튼 — 마스코트(centerX=900, top=100) 보다 우측 + 상단.
// mascot right edge 1000 vs pause left edge 990 (10px 겹침이지만 y 다름 → OK).
const PAUSE_BTN_X = 1020;
const PAUSE_BTN_Y = 60;
const PAUSE_BTN_SIZE = 60;
const PAUSE_ICON_BAR_W = 8;
const PAUSE_ICON_BAR_H = 28;
const PAUSE_ICON_GAP = 6;

export function createHudObjects(
  scene: Phaser.Scene,
  onPauseClick: () => void = () => { /* noop */ },
): HudObjects {
  // HUD 텍스트 — 어두운 stroke 로 *모든 배경 (밝은 낮 / 어두운 밤)* 에서 가독성 유지.
  // 배경이 라운드별 변동이라 고정 색으로는 한쪽이 묻힘 → 외곽선이 맥락 무관 보장 (자막 패턴).
  const HUD_STROKE = '#000000';
  const HUD_STROKE_LABEL = 3; // 작은 라벨 폰트용
  const HUD_STROKE_VALUE = 4; // 큰 값 폰트용

  const scoreLabel = scene.add
    .text(HUD_LEFT_X, HUD_TOP_LABEL_Y, 'SCORE', {
      fontSize: HUD_LABEL_FONT, color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace',
      stroke: HUD_STROKE, strokeThickness: HUD_STROKE_LABEL,
    })
    .setOrigin(0, 0).setScrollFactor(0).setVisible(false);
  const scoreValue = scene.add
    .text(HUD_LEFT_X, HUD_TOP_VALUE_Y, '0', {
      fontSize: HUD_VALUE_FONT, color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace',
      stroke: HUD_STROKE, strokeThickness: HUD_STROKE_VALUE,
    })
    .setOrigin(0, 0).setScrollFactor(0).setVisible(false);

  const highScoreLabel = scene.add
    .text(HUD_CENTER_X, HUD_TOP_LABEL_Y, 'HIGH SCORE', {
      fontSize: HUD_LABEL_FONT, color: '#ff3333', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
      stroke: HUD_STROKE, strokeThickness: HUD_STROKE_LABEL,
    })
    .setOrigin(0.5, 0).setScrollFactor(0).setVisible(false);
  const highScoreValue = scene.add
    .text(HUD_CENTER_X, HUD_TOP_VALUE_Y, '0', {
      fontSize: HUD_VALUE_FONT, color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace',
      stroke: HUD_STROKE, strokeThickness: HUD_STROKE_VALUE,
    })
    .setOrigin(0.5, 0).setScrollFactor(0).setVisible(false);

  const roundLabel = scene.add
    .text(HUD_RIGHT_X, HUD_TOP_LABEL_Y, 'ROUND', {
      fontSize: HUD_LABEL_FONT, color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace',
      stroke: HUD_STROKE, strokeThickness: HUD_STROKE_LABEL,
    })
    .setOrigin(1, 0).setScrollFactor(0).setVisible(false);
  const roundValue = scene.add
    .text(HUD_RIGHT_X, HUD_TOP_VALUE_Y, '1', {
      fontSize: HUD_VALUE_FONT, color: '#ffffff', fontFamily: 'DNFBitBitv2, monospace',
      stroke: HUD_STROKE, strokeThickness: HUD_STROKE_VALUE,
    })
    .setOrigin(1, 0).setScrollFactor(0).setVisible(false);

  const borderTop = scene.add
    .rectangle(360, -PLAYFIELD_BORDER_THICKNESS / 2,
               720 + PLAYFIELD_BORDER_THICKNESS * 2, PLAYFIELD_BORDER_THICKNESS, PLAYFIELD_BORDER_COLOR)
    .setOrigin(0.5, 0.5).setVisible(false);
  // 하단 시각 회색 띠 — *bg_pixel ↔ playfieldBg 시각 경계* 에 위치.
  // playfieldBg = world (360, 450) 중심 + 720x900 → 아래쪽 끝 world y = 900.
  // borderTop 이 playfieldBg 위쪽 끝 (world y=0) 외측 (y=-3) 인 패턴 미러 → y = 903.
  // 충돌 X (시각만) — 바닥은 공이 빠져 죽는 자리.
  const borderBottom = scene.add
    .rectangle(360, 900 + PLAYFIELD_BORDER_THICKNESS / 2,
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
    .text(360, 648, '', {
      fontSize: '14px', color: '#88ccff', fontFamily: 'DNFBitBitv2, monospace',
      stroke: HUD_STROKE, strokeThickness: 2, // 작은 폰트 → 얇은 stroke
    })
    .setOrigin(0.5, 1).setVisible(false);

  // 일시정지 버튼 — 우상단. 공용 Button 컴포넌트 (neutral variant) + label 없이 두 아이콘 바를 container 자식으로 추가.
  // press 시 container.y += 2 → 아이콘 바도 함께 따라감 (container 가 transform SSOT).
  // scrollFactor: 0 — HUD 는 *canvas 절대 좌표계* (UI 카메라) 사용. cx=1020 같은 canvas 우상단 좌표가 그대로 의미.
  const pauseButton = createButton(scene, {
    cx: PAUSE_BTN_X,
    cy: PAUSE_BTN_Y,
    w: PAUSE_BTN_SIZE,
    h: PAUSE_BTN_SIZE,
    label: '',
    variant: 'neutral',
    cornerRadius: 8,
    scrollFactor: 0,
    onClick: onPauseClick,
  });
  // 두 아이콘 바 — container local 좌표 (button center = 0,0 기준).
  // scrollFactor 0 명시 — multi-camera 분류 (GameScene.classifyCameras) 가 자식별로 검사하므로
  // container 의 scrollFactor 만으론 부족. UI 카메라 전용으로 그려져야 함.
  const iconLeft = scene.add
    .rectangle(
      -(PAUSE_ICON_GAP / 2 + PAUSE_ICON_BAR_W / 2), 0,
      PAUSE_ICON_BAR_W, PAUSE_ICON_BAR_H, 0xffffff,
    )
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0, 0);
  const iconRight = scene.add
    .rectangle(
      (PAUSE_ICON_GAP / 2 + PAUSE_ICON_BAR_W / 2), 0,
      PAUSE_ICON_BAR_W, PAUSE_ICON_BAR_H, 0xffffff,
    )
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0, 0);
  pauseButton.container.add(iconLeft);
  pauseButton.container.add(iconRight);

  return {
    scoreLabel, scoreValue, highScoreLabel, highScoreValue, roundLabel, roundValue,
    livesGraphics, borderTop, borderBottom, borderLeft, borderRight, hudEffectTimer,
    pauseButton,
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
  objects.borderBottom.setVisible(true);
  objects.borderLeft.setVisible(true);
  objects.borderRight.setVisible(true);

  // 일시정지 버튼 visible (인게임 HUD 와 동일 lifecycle).
  objects.pauseButton.setVisible(true);

  // 라이프 픽셀하트.
  objects.livesGraphics.clear().setVisible(true);
  const heartY = LIVES_Y_CANVAS - HEART_H / 2;
  for (let i = 0; i < hud.lives; i++) {
    const hx = LIVES_X_START_CANVAS + i * (HEART_W + LIVES_GAP);
    drawHeart(objects.livesGraphics, hx, heartY);
  }

  // 효과 타이머 (magnet 5회 / laser 6초). 색·라벨은 POWERUP_TABLE 참조 (SSOT).
  if (hud.activeEffect === 'magnet') {
    const t = POWERUP_TABLE.magnet;
    const uses = hud.magnetRemainingUses ?? 0;
    objects.hudEffectTimer.setText(`${t.label} ${uses} LEFT`).setColor(colorToHex(t.color)).setVisible(true);
  } else if (hud.activeEffect === 'laser') {
    const t = POWERUP_TABLE.laser;
    const remainSec = ((hud.laserRemainingMs ?? 0) / 1000).toFixed(1);
    objects.hudEffectTimer.setText(`${t.label} ${remainSec}s`).setColor(colorToHex(t.color)).setVisible(true);
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
  objects.borderBottom.setVisible(false);
  objects.borderLeft.setVisible(false);
  objects.borderRight.setVisible(false);
  objects.livesGraphics.clear().setVisible(false);
  objects.hudEffectTimer.setVisible(false);
  objects.pauseButton.setVisible(false);
}
