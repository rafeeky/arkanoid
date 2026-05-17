import type Phaser from 'phaser';
import type { BlockState } from '../../../gameplay/state/BlockState';
import type { BlockDefinition } from '../../../definitions/types/BlockDefinition';
import { BLOCK_WIDTH, BLOCK_HEIGHT } from '../../../gameplay/systems/playfieldLayout';

// 드랍 블록 visualId → 위에 오버레이할 아이템 텍스처 (어떤 아이템이 떨어지는지 알림).
const BLOCK_ITEM_OVERLAY: Record<string, string> = {
  block_basic_drop:  'item_expand',
  block_magnet_drop: 'item_magnet',
  block_laser_drop:  'item_laser',
};
const BLOCK_ICON_W = 40;
const BLOCK_ICON_H = 20;

export type BlocksObjects = {
  blockMap: Map<string, Phaser.GameObjects.Image>;
  blockIconMap: Map<string, Phaser.GameObjects.Image>;
};

export function createBlocksObjects(): BlocksObjects {
  return {
    blockMap: new Map(),
    blockIconMap: new Map(),
  };
}

export function renderBlocks(
  scene: Phaser.Scene,
  objects: BlocksObjects,
  blocks: readonly Readonly<BlockState>[],
  blockDefinitions: Readonly<Record<string, BlockDefinition>>,
  flashBlockIds: ReadonlySet<string>,
): void {
  const activeBlockIds = new Set<string>();
  for (const block of blocks) {
    if (block.isDestroyed) continue;
    activeBlockIds.add(block.id);

    const def = blockDefinitions[block.definitionId];
    const frameName = def?.visualId ?? 'block_basic';

    let img = objects.blockMap.get(block.id);
    if (!img) {
      img = scene.add
        .image(block.x, block.y, frameName)
        .setOrigin(0, 0)
        .setDisplaySize(BLOCK_WIDTH, BLOCK_HEIGHT);
      objects.blockMap.set(block.id, img);
    }

    if (flashBlockIds.has(block.id)) img.setTintFill(0xffffff);
    else img.clearTint();
    img.setPosition(block.x, block.y).setVisible(true);

    // 드랍 블록 아이콘 오버레이.
    const overlayKey = BLOCK_ITEM_OVERLAY[frameName];
    if (overlayKey !== undefined) {
      let icon = objects.blockIconMap.get(block.id);
      if (!icon) {
        icon = scene.add
          .image(0, 0, overlayKey)
          .setOrigin(0.5, 0.5)
          .setDisplaySize(BLOCK_ICON_W, BLOCK_ICON_H);
        objects.blockIconMap.set(block.id, icon);
      }
      icon
        .setTexture(overlayKey)
        .setPosition(block.x + BLOCK_WIDTH / 2, block.y + BLOCK_HEIGHT / 2)
        .setVisible(true);
    }
  }

  for (const [id, img] of objects.blockMap) {
    if (!activeBlockIds.has(id)) img.setVisible(false);
  }
  for (const [id, icon] of objects.blockIconMap) {
    if (!activeBlockIds.has(id)) icon.setVisible(false);
  }
}

export function hideBlocks(objects: BlocksObjects): void {
  for (const img of objects.blockMap.values()) img.setVisible(false);
  for (const icon of objects.blockIconMap.values()) icon.setVisible(false);
}
