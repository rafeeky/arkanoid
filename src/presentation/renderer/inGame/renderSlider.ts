import type Phaser from 'phaser';
import type { GameplayRuntimeState } from '../../../gameplay/state/GameplayRuntimeState';
import { LayoutConfigTable } from '../../../definitions/tables/LayoutConfigTable';

export type SliderObjects = {
  track: Phaser.GameObjects.Rectangle;
  /** 노브 — 선택된 마스코트 portrait. 둥근 stroke 으로 동그라미 느낌. */
  knob: Phaser.GameObjects.Image;
  /** 노브 외곽 흰 stroke (Image 는 stroke 미지원이라 별도 원). */
  knobRing: Phaser.GameObjects.Arc;
  launchHint: Phaser.GameObjects.Text;
};

export function createSliderObjects(scene: Phaser.Scene): SliderObjects {
  const L = LayoutConfigTable.barSlider;
  const trackCenterX = LayoutConfigTable.canvas.width / 2;

  const track = scene.add
    .rectangle(trackCenterX, L.centerY, L.trackHalfWidth * 2, L.trackHeight, 0x2233aa)
    .setOrigin(0.5, 0.5)
    .setStrokeStyle(2, 0x4466cc)
    .setScrollFactor(0)
    .setVisible(false);
  // 노브 — 마스코트 portrait. portrait2.<id> 텍스처 매 프레임 갱신.
  const knob = scene.add
    .image(trackCenterX, L.centerY, 'portrait2.albatross')
    .setDisplaySize(L.knobRadius * 2, L.knobRadius * 2)
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);
  // 동그라미 느낌 위한 외곽 흰 ring (Image stroke 미지원).
  const knobRing = scene.add
    .arc(trackCenterX, L.centerY, L.knobRadius, 0, 360, false, 0xffffff, 0)
    .setStrokeStyle(4, 0xffffff)
    .setScrollFactor(0)
    .setVisible(false);

  const launchHint = scene.add
    .text(LayoutConfigTable.canvas.width / 2, L.centerY - 50, 'TAP HERE TO LAUNCH', {
      fontSize: '24px', color: '#ffff66', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  return { track, knob, knobRing, launchHint };
}

export function renderSlider(
  objects: SliderObjects,
  gameplayState: Readonly<GameplayRuntimeState>,
  /** 선택된 마스코트 id (얼굴 텍스처). 미지정 시 albatross. */
  selectedMascotId?: string,
): void {
  const L = LayoutConfigTable.barSlider;
  const trackCenterX = LayoutConfigTable.canvas.width / 2;
  const halfBar = gameplayState.bar.width / 2;
  const playfieldW = LayoutConfigTable.playfield.width;
  const denom = playfieldW - 2 * halfBar;
  const ratio = denom > 0 ? (gameplayState.bar.x - halfBar) / denom : 0.5;
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const knobX = trackCenterX - L.trackHalfWidth + clampedRatio * (L.trackHalfWidth * 2);

  objects.track.setVisible(true);
  const mascotId = selectedMascotId ?? 'albatross';
  objects.knob
    .setTexture(`portrait2.${mascotId}`)
    .setPosition(knobX, L.centerY)
    .setDisplaySize(L.knobRadius * 2, L.knobRadius * 2)
    .setVisible(true);
  objects.knobRing.setPosition(knobX, L.centerY).setVisible(true);

  // 발사 hint — 비활성 공 OR 자석 부착 시 깜빡임.
  const needsLaunchHint =
    gameplayState.balls.some((b) => !b.isActive) ||
    (gameplayState.bar.activeEffect === 'magnet' && gameplayState.attachedBallIds.length > 0);
  if (needsLaunchHint) {
    const blink = Math.floor(performance.now() / 600) % 2 === 0;
    objects.launchHint.setAlpha(blink ? 1 : 0.45).setVisible(true);
  } else {
    objects.launchHint.setVisible(false);
  }
}

export function hideSlider(objects: SliderObjects): void {
  objects.track.setVisible(false);
  objects.knob.setVisible(false);
  objects.knobRing.setVisible(false);
  objects.launchHint.setVisible(false);
}
