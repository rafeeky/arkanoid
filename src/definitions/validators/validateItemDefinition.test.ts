import { describe, it, expect } from 'vitest';
import { validateItemDefinition } from './validateItemDefinition';
import { ItemDefinitionTable } from '../tables/ItemDefinitionTable';

describe('validateItemDefinition', () => {
  it('passes for the "expand" item', () => {
    const result = validateItemDefinition(ItemDefinitionTable['expand']!);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when fallSpeed is 0', () => {
    const result = validateItemDefinition({
      itemType: 'expand',
      displayNameTextId: 'txt_item_expand_name',
      descriptionTextId: 'txt_item_expand_desc',
      iconId: 'icon_item_expand',
      fallSpeed: 0,
      effectType: 'expand',
      expandMultiplier: 1.5,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('fallSpeed'))).toBe(true);
  });

  it('fails when expandMultiplier is exactly 1', () => {
    const result = validateItemDefinition({
      itemType: 'expand',
      displayNameTextId: 'txt_item_expand_name',
      descriptionTextId: 'txt_item_expand_desc',
      iconId: 'icon_item_expand',
      fallSpeed: 160,
      effectType: 'expand',
      expandMultiplier: 1,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('expandMultiplier'))).toBe(true);
  });

  // magnet 테스트
  it('passes for the "magnet" item', () => {
    const result = validateItemDefinition(ItemDefinitionTable['magnet']!);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when magnetDurationMs is 0', () => {
    const result = validateItemDefinition({
      itemType: 'magnet',
      displayNameTextId: 'txt_item_magnet_name',
      descriptionTextId: 'txt_item_magnet_desc',
      iconId: 'icon_item_magnet',
      fallSpeed: 160,
      effectType: 'magnet',
      magnetDurationMs: 0,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('magnetDurationMs'))).toBe(true);
  });

  it('fails when magnetDurationMs is missing', () => {
    const result = validateItemDefinition({
      itemType: 'magnet',
      displayNameTextId: 'txt_item_magnet_name',
      descriptionTextId: 'txt_item_magnet_desc',
      iconId: 'icon_item_magnet',
      fallSpeed: 160,
      effectType: 'magnet',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('magnetDurationMs'))).toBe(true);
  });

  // laser 테스트
  it('passes for the "laser" item', () => {
    const result = validateItemDefinition(ItemDefinitionTable['laser']!);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when laserCooldownMs is 0', () => {
    const result = validateItemDefinition({
      itemType: 'laser',
      displayNameTextId: 'txt_item_laser_name',
      descriptionTextId: 'txt_item_laser_desc',
      iconId: 'icon_item_laser',
      fallSpeed: 160,
      effectType: 'laser',
      laserCooldownMs: 0,
      laserShotCount: 2,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('laserCooldownMs'))).toBe(true);
  });

  it('fails when laserShotCount is 0', () => {
    const result = validateItemDefinition({
      itemType: 'laser',
      displayNameTextId: 'txt_item_laser_name',
      descriptionTextId: 'txt_item_laser_desc',
      iconId: 'icon_item_laser',
      fallSpeed: 160,
      effectType: 'laser',
      laserCooldownMs: 400,
      laserShotCount: 0,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('laserShotCount'))).toBe(true);
  });

  it('fails when laserCooldownMs and laserShotCount are both missing', () => {
    const result = validateItemDefinition({
      itemType: 'laser',
      displayNameTextId: 'txt_item_laser_name',
      descriptionTextId: 'txt_item_laser_desc',
      iconId: 'icon_item_laser',
      fallSpeed: 160,
      effectType: 'laser',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
