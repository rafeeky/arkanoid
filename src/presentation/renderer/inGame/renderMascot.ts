import type Phaser from 'phaser';
import { LayoutConfigTable } from '../../../definitions/tables/LayoutConfigTable';

const CHEER_MASCOT_CANVAS_X = LayoutConfigTable.mascot.centerX;
const CHEER_MASCOT_CANVAS_Y = LayoutConfigTable.mascot.centerY;
const CHEER_MASCOT_SIZE = LayoutConfigTable.mascot.size;

export type MascotObjects = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
};

export type CheerMascot = {
  id: string;
  displayName: string;
  placeholderColor: number;
  placeholderStrokeColor: number;
};

export function createMascotObjects(scene: Phaser.Scene): MascotObjects {
  const sprite = scene.add
    .image(0, 0, 'mascot.albatross.frame0')
    .setOrigin(0.5, 0.5)
    .setDisplaySize(CHEER_MASCOT_SIZE, CHEER_MASCOT_SIZE);
  const container = scene.add
    .container(CHEER_MASCOT_CANVAS_X, CHEER_MASCOT_CANVAS_Y, [sprite])
    .setScrollFactor(0)
    .setVisible(false);
  return { container, sprite };
}

export function renderMascot(objects: MascotObjects, mascot?: CheerMascot): void {
  if (mascot) {
    const frameIdx = Math.floor(performance.now() / 200) % 4;
    objects.sprite.setTexture(`mascot.${mascot.id}.frame${frameIdx}`);
    objects.container.setVisible(true);
  } else {
    objects.container.setVisible(false);
  }
}

export function hideMascot(objects: MascotObjects): void {
  objects.container.setVisible(false);
}
