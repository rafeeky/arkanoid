import type Phaser from 'phaser';
import type { ItemDropState } from '../../../gameplay/state/ItemDropState';
import { ITEM_WIDTH, ITEM_HEIGHT } from '../../../gameplay/systems/playfieldLayout';

// 아이템 텍스처 키 매핑.
const ITEM_TEX: Record<string, string> = {
  expand: 'item_expand',
  magnet: 'item_magnet',
  laser:  'item_laser',
};
const ITEM_TEX_DEFAULT = 'item_expand';

export type ItemsObjects = {
  itemMap: Map<string, Phaser.GameObjects.Image>;
};

export function createItemsObjects(): ItemsObjects {
  return { itemMap: new Map() };
}

export function renderItems(
  scene: Phaser.Scene,
  objects: ItemsObjects,
  itemDrops: readonly Readonly<ItemDropState>[],
): void {
  const activeItemIds = new Set<string>();
  for (const item of itemDrops) {
    if (item.isCollected) continue;
    activeItemIds.add(item.id);

    let img = objects.itemMap.get(item.id);
    if (!img) {
      const key = ITEM_TEX[item.itemType] ?? ITEM_TEX_DEFAULT;
      img = scene.add
        .image(item.x, item.y, key)
        .setDisplaySize(ITEM_WIDTH, ITEM_HEIGHT)
        .setOrigin(0.5, 0.5);
      objects.itemMap.set(item.id, img);
    }
    img.setPosition(item.x, item.y);
    img.angle = (item.y * 2) % 360;
    img.setVisible(true);
  }

  for (const [id, img] of objects.itemMap) {
    if (!activeItemIds.has(id)) img.setVisible(false);
  }
}

export function hideItems(objects: ItemsObjects): void {
  for (const img of objects.itemMap.values()) img.setVisible(false);
}
