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
});
