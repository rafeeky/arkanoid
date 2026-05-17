import type Phaser from 'phaser';
import type { BorderBlockState } from '../../../gameplay/state/BorderBlockState';
import type { DoorState } from '../../../gameplay/state/DoorState';
import { BORDER_LENGTH, BORDER_THICKNESS } from '../../../gameplay/systems/playfieldLayout';

export type BordersObjects = {
  borderMap: Map<string, Phaser.GameObjects.Image>;
  doorMap: Map<string, Phaser.GameObjects.Image>;
};

export function createBordersObjects(): BordersObjects {
  return {
    borderMap: new Map(),
    doorMap: new Map(),
  };
}

export function renderBorders(
  scene: Phaser.Scene,
  objects: BordersObjects,
  borders: readonly Readonly<BorderBlockState>[],
  doors: readonly Readonly<DoorState>[],
): void {
  // Border.
  const activeBorderIds = new Set<string>();
  for (const border of borders) {
    activeBorderIds.add(border.id);
    const w = border.orientation === 'horizontal' ? BORDER_LENGTH : BORDER_THICKNESS;
    const h = border.orientation === 'horizontal' ? BORDER_THICKNESS : BORDER_LENGTH;
    const key = border.orientation === 'horizontal' ? 'border_horizontal' : 'border_vertical';

    let img = objects.borderMap.get(border.id);
    if (!img) {
      img = scene.add
        .image(border.x, border.y, key)
        .setOrigin(0, 0)
        .setDisplaySize(w, h);
      objects.borderMap.set(border.id, img);
    }
    img.setPosition(border.x, border.y).setDisplaySize(w, h).setVisible(true);
  }
  for (const [id, img] of objects.borderMap) {
    if (!activeBorderIds.has(id)) img.setVisible(false);
  }

  // Door — closed / opening (5프레임) / opened (hidden).
  const activeDoorIds = new Set<string>();
  for (const door of doors) {
    activeDoorIds.add(door.id);
    let img = objects.doorMap.get(door.id);
    if (!img) {
      img = scene.add
        .image(door.x, door.y, 'door_closed')
        .setOrigin(0, 0)
        .setDisplaySize(BORDER_LENGTH, BORDER_THICKNESS);
      objects.doorMap.set(door.id, img);
    }
    if (door.phase === 'opened') {
      img.setVisible(false);
    } else if (door.phase === 'opening') {
      const t = Math.min(1, door.openingElapsedMs / 600);
      const frameIdx = Math.min(4, Math.floor(t * 5));
      img.setTexture(`door_opening_${frameIdx}`);
      img.setPosition(door.x, door.y)
        .setDisplaySize(BORDER_LENGTH, BORDER_THICKNESS)
        .setVisible(true);
    } else {
      img.setTexture('door_closed');
      img.setPosition(door.x, door.y)
        .setDisplaySize(BORDER_LENGTH, BORDER_THICKNESS)
        .setVisible(true);
    }
  }
  for (const [id, img] of objects.doorMap) {
    if (!activeDoorIds.has(id)) img.setVisible(false);
  }
}

export function hideBorders(objects: BordersObjects): void {
  for (const img of objects.borderMap.values()) img.setVisible(false);
  for (const img of objects.doorMap.values()) img.setVisible(false);
}
