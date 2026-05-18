import type { ItemDefinition } from '../types/ItemDefinition';

export const ItemDefinitionTable: Record<string, ItemDefinition> = {
  expand: {
    itemType: 'expand',
    displayNameTextId: 'txt_item_expand_name',
    descriptionTextId: 'txt_item_expand_desc',
    iconId: 'icon_item_expand',
    fallSpeed: 160,
    effectType: 'expand',
    expandMultiplier: 1.5,
  },
  magnet: {
    itemType: 'magnet',
    displayNameTextId: 'txt_item_magnet_name',
    descriptionTextId: 'txt_item_magnet_desc',
    iconId: 'icon_item_magnet',
    fallSpeed: 160,
    effectType: 'magnet',
    magnetDurationMs: 8000,   // 호환 유지 (validator 통과용)
    magnetUseCount: 5,         // 2026-05-18: 5회 부착 후 효과 종료
  },
  laser: {
    itemType: 'laser',
    displayNameTextId: 'txt_item_laser_name',
    descriptionTextId: 'txt_item_laser_desc',
    iconId: 'icon_item_laser',
    fallSpeed: 160,
    effectType: 'laser',
    laserCooldownMs: 400,
    laserShotCount: 2,
    laserDurationMs: 6000,     // 2026-05-18: 6초 지속
  },
};
