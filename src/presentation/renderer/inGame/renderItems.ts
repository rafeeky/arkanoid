import type Phaser from 'phaser';
import type { ItemDropState } from '../../../gameplay/state/ItemDropState';
import { ITEM_WIDTH, ITEM_HEIGHT } from '../../../gameplay/systems/playfieldLayout';

// 아이템 드랍 = 블록 (색 사각형) + 흰 아이콘. 블록의 drop 표시와 동일.
const ITEM_BLOCK_TEX: Record<string, string> = {
  expand: 'block_basic_drop',
  magnet: 'block_magnet_drop',
  laser:  'block_laser_drop',
};
const ITEM_BLOCK_TEX_DEFAULT = 'block_basic_drop';
const ITEM_ICON_TEX: Record<string, string> = {
  expand: 'icon_expand',
  magnet: 'icon_magnet',
  laser:  'icon_laser',
};
const ITEM_ICON_TEX_DEFAULT = 'icon_expand';
const ICON_W = 36;
const ICON_H = 18;

export type ItemsObjects = {
  /** 색 사각형 (block_X_drop 텍스처). */
  itemMap: Map<string, Phaser.GameObjects.Image>;
  /** 흰 아이콘 overlay (icon_X). 블록 위 아이콘과 동일 텍스처. */
  itemIconMap: Map<string, Phaser.GameObjects.Image>;
};

export function createItemsObjects(): ItemsObjects {
  return {
    itemMap: new Map(),
    itemIconMap: new Map(),
  };
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

    const blockKey = ITEM_BLOCK_TEX[item.itemType] ?? ITEM_BLOCK_TEX_DEFAULT;
    const iconKey  = ITEM_ICON_TEX[item.itemType]  ?? ITEM_ICON_TEX_DEFAULT;
    const angle = (item.y * 2) % 360;

    let img = objects.itemMap.get(item.id);
    if (!img) {
      img = scene.add
        .image(item.x, item.y, blockKey)
        .setDisplaySize(ITEM_WIDTH, ITEM_HEIGHT)
        .setOrigin(0.5, 0.5);
      objects.itemMap.set(item.id, img);
    }
    img.setTexture(blockKey).setPosition(item.x, item.y).setDisplaySize(ITEM_WIDTH, ITEM_HEIGHT);
    img.angle = angle;
    img.setVisible(true);

    let icon = objects.itemIconMap.get(item.id);
    if (!icon) {
      icon = scene.add
        .image(item.x, item.y, iconKey)
        .setDisplaySize(ICON_W, ICON_H)
        .setOrigin(0.5, 0.5);
      objects.itemIconMap.set(item.id, icon);
    }
    icon.setTexture(iconKey).setPosition(item.x, item.y).setDisplaySize(ICON_W, ICON_H);
    icon.angle = angle;
    icon.setVisible(true);
  }

  for (const [id, img] of objects.itemMap) {
    if (!activeItemIds.has(id)) img.setVisible(false);
  }
  for (const [id, icon] of objects.itemIconMap) {
    if (!activeItemIds.has(id)) icon.setVisible(false);
  }
}

export function hideItems(objects: ItemsObjects): void {
  for (const img of objects.itemMap.values()) img.setVisible(false);
  for (const icon of objects.itemIconMap.values()) icon.setVisible(false);
}
