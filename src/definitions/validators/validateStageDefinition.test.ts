import { describe, it, expect } from 'vitest';
import { validateStageDefinition } from './validateStageDefinition';
import { StageDefinitionTable } from '../tables/StageDefinitionTable';
import { BlockDefinitionTable } from '../tables/BlockDefinitionTable';

describe('validateStageDefinition', () => {
  it('passes for stage1 with the full BlockDefinitionTable', () => {
    const stage1 = StageDefinitionTable[0];
    expect(stage1).toBeDefined();
    const result = validateStageDefinition(stage1!, BlockDefinitionTable);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('stage1 has exactly 65 block placements', () => {
    const stage1 = StageDefinitionTable[0];
    expect(stage1!.blocks).toHaveLength(65);
  });

  it('stage1 has exactly 6 "basic_drop" placements', () => {
    const stage1 = StageDefinitionTable[0];
    const dropCount = stage1!.blocks.filter(
      (b) => b.definitionId === 'basic_drop'
    ).length;
    expect(dropCount).toBe(6);
  });

  it('fails when a block references an unknown definitionId', () => {
    const stage1 = StageDefinitionTable[0]!;
    const corrupted = {
      ...stage1,
      blocks: [
        ...stage1.blocks,
        { row: 0, col: 0, definitionId: 'unknown_id' },
      ],
    };
    const result = validateStageDefinition(corrupted, BlockDefinitionTable);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('unknown_id'))).toBe(true);
  });

  it('fails on duplicate block coordinates', () => {
    const stage1 = StageDefinitionTable[0]!;
    const corrupted = {
      ...stage1,
      blocks: [
        { row: 0, col: 0, definitionId: 'basic' },
        { row: 0, col: 0, definitionId: 'basic' },
      ],
    };
    const result = validateStageDefinition(corrupted, BlockDefinitionTable);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('fails when row is out of range', () => {
    const stage1 = StageDefinitionTable[0]!;
    const corrupted = {
      ...stage1,
      blocks: [{ row: 10, col: 0, definitionId: 'basic' }],
    };
    const result = validateStageDefinition(corrupted, BlockDefinitionTable);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('row'))).toBe(true);
  });

  it('fails when col is out of range', () => {
    const stage1 = StageDefinitionTable[0]!;
    const corrupted = {
      ...stage1,
      blocks: [{ row: 0, col: 20, definitionId: 'basic' }],
    };
    const result = validateStageDefinition(corrupted, BlockDefinitionTable);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('col'))).toBe(true);
  });
});
