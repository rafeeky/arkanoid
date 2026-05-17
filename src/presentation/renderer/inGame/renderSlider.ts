import type Phaser from 'phaser';
import type { GameplayRuntimeState } from '../../../gameplay/state/GameplayRuntimeState';
import { LayoutConfigTable } from '../../../definitions/tables/LayoutConfigTable';

export type SliderObjects = {
  track: Phaser.GameObjects.Rectangle;
  knob: Phaser.GameObjects.Arc;
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
  const knob = scene.add
    .arc(trackCenterX, L.centerY, L.knobRadius, 0, 360, false, 0xeeeeee)
    .setStrokeStyle(3, 0x666666)
    .setScrollFactor(0)
    .setVisible(false);

  const launchHint = scene.add
    .text(LayoutConfigTable.canvas.width / 2, L.centerY - 50, 'TAP HERE TO LAUNCH', {
      fontSize: '24px', color: '#ffff66', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  return { track, knob, launchHint };
}

export function renderSlider(
  objects: SliderObjects,
  gameplayState: Readonly<GameplayRuntimeState>,
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
  objects.knob.setPosition(knobX, L.centerY).setVisible(true);

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
  objects.launchHint.setVisible(false);
}
