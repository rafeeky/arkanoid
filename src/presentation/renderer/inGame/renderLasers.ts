import type Phaser from 'phaser';
import type { LaserShotState } from '../../../gameplay/state/LaserShotState';

const LASER_WIDTH = 2;
const LASER_HEIGHT = 16;
const LASER_COLOR = 0xff4444;

export type LasersObjects = {
  laserMap: Map<string, Phaser.GameObjects.Rectangle>;
};

export function createLasersObjects(): LasersObjects {
  return { laserMap: new Map() };
}

export function renderLasers(
  scene: Phaser.Scene,
  objects: LasersObjects,
  laserShots: readonly Readonly<LaserShotState>[],
): void {
  const activeShotIds = new Set<string>();
  for (const shot of laserShots) {
    activeShotIds.add(shot.id);
    let rect = objects.laserMap.get(shot.id);
    if (!rect) {
      rect = scene.add.rectangle(shot.x, shot.y, LASER_WIDTH, LASER_HEIGHT, LASER_COLOR);
      objects.laserMap.set(shot.id, rect);
    }
    rect.setPosition(shot.x, shot.y).setVisible(true);
  }
  for (const [id, rect] of objects.laserMap) {
    if (!activeShotIds.has(id)) rect.setVisible(false);
  }
}

export function hideLasers(objects: LasersObjects): void {
  for (const rect of objects.laserMap.values()) rect.setVisible(false);
}
