import type Phaser from 'phaser';
import type { GameplayRuntimeState } from '../../../gameplay/state/GameplayRuntimeState';
import { LayoutConfigTable } from '../../../definitions/tables/LayoutConfigTable';

export type SliderObjects = {
  /** 캡슐형 둥근 트랙 (Graphics). 양 끝 반원. */
  track: Phaser.GameObjects.Graphics;
  /** 노브 — 마스코트 portrait. */
  knob: Phaser.GameObjects.Image;
  /** 노브 외곽 흰 ring. */
  knobRing: Phaser.GameObjects.Arc;
  /** 드래그 hint — 슬라이더 우측 하단. "DRAG TO MOVE BAR" 같은 안내. */
  dragHint: Phaser.GameObjects.Text;
  /** TAP HERE TO LAUNCH 텍스트 — 비활성 공/자석 부착 시 깜빡임. */
  launchHint: Phaser.GameObjects.Text;
};

// 트랙 색 — 청록 톤 (검정/회색 배경에 잘 살고 NORMAL 초록/HARD 빨강과 톤 분리).
const TRACK_FILL = 0x22aacc;
const TRACK_STROKE = 0x66ddff;

export function createSliderObjects(scene: Phaser.Scene): SliderObjects {
  const L = LayoutConfigTable.barSlider;
  const trackCenterX = LayoutConfigTable.canvas.width / 2;
  const trackW = L.trackHalfWidth * 2;
  const trackH = L.trackHeight;

  // 캡슐형 트랙 (Graphics) — 양 끝 둥글게 (cornerRadius = trackH/2).
  const track = scene.add.graphics().setScrollFactor(0).setVisible(false);
  const trackLeft = trackCenterX - L.trackHalfWidth;
  const trackTop = L.centerY - trackH / 2;
  const cornerR = trackH / 2;
  track.fillStyle(TRACK_FILL, 1);
  track.fillRoundedRect(trackLeft, trackTop, trackW, trackH, cornerR);
  track.lineStyle(2, TRACK_STROKE, 1);
  track.strokeRoundedRect(trackLeft, trackTop, trackW, trackH, cornerR);

  // 드래그 hint — 슬라이더 우측 하단. 한 번 보여줘서 "드래그해라" 알림.
  const dragHint = scene.add
    .text(trackCenterX + L.trackHalfWidth, L.centerY + L.knobRadius + 12, 'DRAG TO MOVE BAR', {
      fontSize: '18px', color: '#ffff66', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(1, 0).setScrollFactor(0).setVisible(false);

  // 노브 — 마스코트 portrait. portrait2.<id> 텍스처 매 프레임 갱신.
  const knob = scene.add
    .image(trackCenterX, L.centerY, 'portrait2.albatross')
    .setDisplaySize(L.knobRadius * 2, L.knobRadius * 2)
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);
  // 동그라미 느낌 외곽 흰 ring.
  const knobRing = scene.add
    .arc(trackCenterX, L.centerY, L.knobRadius, 0, 360, false, 0xffffff, 0)
    .setStrokeStyle(4, 0xffffff)
    .setScrollFactor(0)
    .setVisible(false);

  // TAP HERE TO LAUNCH — 살짝 위로 (마스코트 얼굴과 겹침 방지).
  const launchHint = scene.add
    .text(LayoutConfigTable.canvas.width / 2, L.centerY - 54, 'TAP HERE TO LAUNCH', {
      fontSize: '24px', color: '#ffff66', fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  return { track, knob, knobRing, dragHint, launchHint };
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

  // 드래그 hint — 우측 하단. 항상 보이되 약간 깜빡임.
  const dragBlink = Math.floor(performance.now() / 900) % 2 === 0;
  objects.dragHint.setAlpha(dragBlink ? 1 : 0.55).setVisible(true);

  // 발사 hint — 비활성 공 OR 자석 부착 시 깜빡임.
  const needsLaunchHint =
    gameplayState.balls.some((b) => !b.isActive) ||
    (gameplayState.bar.activeEffect === 'magnet' && gameplayState.attachedBallIds.length > 0);
  if (needsLaunchHint) {
    const launchBlink = Math.floor(performance.now() / 600) % 2 === 0;
    objects.launchHint.setAlpha(launchBlink ? 1 : 0.45).setVisible(true);
  } else {
    objects.launchHint.setVisible(false);
  }
}

export function hideSlider(objects: SliderObjects): void {
  objects.track.setVisible(false);
  objects.knob.setVisible(false);
  objects.knobRing.setVisible(false);
  objects.dragHint.setVisible(false);
  objects.launchHint.setVisible(false);
}
