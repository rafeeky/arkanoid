import type Phaser from 'phaser';
import type { BarState } from '../../../gameplay/state/BarState';
import type { BarEffectKind } from '../../../gameplay/events/gameplayEvents';
import { POWERUP_TABLE, colorToHex, type PowerupId } from '../../../definitions/tables/PowerupTable';

/**
 * 파워업 획득 토스트 — 일정 위치에 *짧은 팝* 으로 표시.
 *
 * 색/아이콘/라벨은 모두 `POWERUP_TABLE` 참조 (SSOT).
 * 연출: scale 0.5→1 + alpha 0→1 (100ms) → hold 400ms → fade alpha 1→0 (300ms). 총 ~800ms.
 *
 * 위치 = canvas 가운데(x) + bar.y - offset(y). *바를 따라가지 않음* — 일정 위치 유지.
 */

const FADE_DELAY_MS = 500;     // 등장 후 hold + fade 시작 지연
const FADE_OUT_MS = 300;
const POP_IN_MS = 100;
const ICON_SIZE = 32;
const ICON_LABEL_GAP = 8;
const TOAST_Y_OFFSET = 32; // bar 위쪽 32px

export type ToastObjects = {
  /** 아이콘 (텍스처 키는 POWERUP_TABLE.iconKey). */
  icon: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
  state: { prevEffect: BarEffectKind; scene: Phaser.Scene };
};

export function createToastObjects(scene: Phaser.Scene): ToastObjects {
  const icon = scene.add
    .image(0, 0, 'icon_expand')
    .setOrigin(1, 0.5) // 텍스트 왼쪽
    .setDisplaySize(ICON_SIZE, ICON_SIZE)
    .setAlpha(0)
    .setVisible(false);
  const text = scene.add
    .text(0, 0, '', {
      fontSize: '36px',
      color: '#ffffff',
      fontFamily: 'DNFBitBitv2, monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    })
    .setOrigin(0, 0.5) // 아이콘 오른쪽
    .setAlpha(0)
    .setVisible(false);
  return { icon, text, state: { prevEffect: 'none', scene } };
}

export function renderToast(objects: ToastObjects, bar: Readonly<BarState>): void {
  const curr = bar.activeEffect;
  if (curr === objects.state.prevEffect) return;
  objects.state.prevEffect = curr;
  if (curr === 'none') return;

  const token = POWERUP_TABLE[curr as PowerupId];
  if (token === undefined) return;

  const { scene } = objects.state;
  const { icon, text } = objects;

  // 일정 위치 — canvas 가로 가운데 + bar.y 위쪽 일정 offset.
  // 아이콘과 텍스트 합쳐 가운데 정렬 위해 icon 오른쪽 끝 = anchor, text 왼쪽 시작 = 오른쪽.
  text.setText(`${token.label}!`).setColor(colorToHex(token.color));
  // setText 후 width 사용 가능 — 가운데 정렬 계산.
  const totalW = ICON_SIZE + ICON_LABEL_GAP + text.width;
  const anchorX = 360; // playfield 가운데 (main 카메라 좌표계 — bar 와 같은 카메라).
  const cy = bar.y - TOAST_Y_OFFSET;
  icon.setTexture(token.iconKey);
  icon.setPosition(anchorX - totalW / 2 + ICON_SIZE, cy);
  text.setPosition(anchorX - totalW / 2 + ICON_SIZE + ICON_LABEL_GAP, cy);

  // 진행 중인 tween 모두 정리 (연속 획득 케이스).
  scene.tweens.killTweensOf([icon, text]);

  // 초기 상태 — 작게 + 투명.
  icon.setVisible(true).setAlpha(0).setScale(0.5);
  text.setVisible(true).setAlpha(0).setScale(0.5);

  // 1) scale in + alpha in (100ms, Back.out 으로 살짝 튀어나옴).
  scene.tweens.add({
    targets: [icon, text],
    scale: 1,
    alpha: 1,
    duration: POP_IN_MS,
    ease: 'Back.out',
  });
  // 2) hold 후 fade out (alpha 만).
  scene.tweens.add({
    targets: [icon, text],
    alpha: 0,
    delay: FADE_DELAY_MS,
    duration: FADE_OUT_MS,
    onComplete: () => {
      icon.setVisible(false);
      text.setVisible(false);
    },
  });
}

export function hideToast(objects: ToastObjects): void {
  objects.state.scene.tweens.killTweensOf([objects.icon, objects.text]);
  objects.icon.setVisible(false);
  objects.text.setVisible(false);
}
