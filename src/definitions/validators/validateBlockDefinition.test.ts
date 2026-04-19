import { describe, it, expect } from 'vitest';
import { validateBlockDefinition } from './validateBlockDefinition';
import { BlockDefinitionTable } from '../tables/BlockDefinitionTable';

describe('validateBlockDefinition', () => {
  it('passes for the "basic" block', () => {
    const result = validateBlockDefinition(BlockDefinitionTable['basic']!);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes for the "basic_drop" block', () => {
    const result = validateBlockDefinition(BlockDefinitionTable['basic_drop']!);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes for the "tough" block', () => {
    const result = validateBlockDefinition(BlockDefinitionTable['tough']!);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes for the "magnet_drop" block', () => {
    const result = validateBlockDefinition(BlockDefinitionTable['magnet_drop']!);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes for the "laser_drop" block', () => {
    const result = validateBlockDefinition(BlockDefinitionTable['laser_drop']!);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when dropItemType is invalid', () => {
    const result = validateBlockDefinition({
      definitionId: 'invalid_drop',
      maxHits: 1,
      score: 10,
      dropItemType: 'unknown' as 'none',
      visualId: 'block_invalid_drop',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('dropItemType'))).toBe(true);
  });

  it('fails when maxHits is 0', () => {
    const result = validateBlockDefinition({
      definitionId: 'invalid',
      maxHits: 0,
      score: 10,
      dropItemType: 'none',
      visualId: 'block_invalid',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('maxHits'))).toBe(true);
  });

  it('fails when score is negative', () => {
    const result = validateBlockDefinition({
      definitionId: 'invalid',
      maxHits: 1,
      score: -5,
      dropItemType: 'none',
      visualId: 'block_invalid',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('score'))).toBe(true);
  });
});
