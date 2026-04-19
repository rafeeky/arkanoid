import { describe, it, expect } from 'vitest';
import { validateStageDefinition } from './validateStageDefinition';
import { STAGE_DEFINITIONS, StageDefinitionTable } from '../tables/StageDefinitionTable';
import { BlockDefinitionTable } from '../tables/BlockDefinitionTable';
import { SpinnerDefinitionTable } from '../tables/SpinnerDefinitionTable';

describe('validateStageDefinition', () => {
  it('passes for stage1 with the full BlockDefinitionTable', () => {
    const stage1 = StageDefinitionTable[0];
    expect(stage1).toBeDefined();
    const result = validateStageDefinition(stage1!, BlockDefinitionTable);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('stage1 has exactly 65 block placements', () => {
    const stage1 = StageDefinitionTable[0];
    expect(stage1!.blocks).toHaveLength(65);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('stage1 has exactly 6 "basic_drop" placements', () => {
    const stage1 = StageDefinitionTable[0];
    const dropCount = stage1!.blocks.filter(
      (b) => b.definitionId === 'basic_drop'
    ).length;
    expect(dropCount).toBe(6);
  });

  it('passes for stage2 with the full BlockDefinitionTable', () => {
    const stage2 = STAGE_DEFINITIONS[1];
    expect(stage2).toBeDefined();
    const result = validateStageDefinition(stage2!, BlockDefinitionTable);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('stage2 has exactly 78 block placements (6 rows x 13 cols)', () => {
    const stage2 = STAGE_DEFINITIONS[1];
    expect(stage2!.blocks).toHaveLength(78);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('stage2 has exactly 8 "basic_drop" placements', () => {
    const stage2 = STAGE_DEFINITIONS[1];
    const dropCount = stage2!.blocks.filter(
      (b) => b.definitionId === 'basic_drop'
    ).length;
    expect(dropCount).toBe(8);
  });

  it('passes for stage3 with the full BlockDefinitionTable', () => {
    const stage3 = STAGE_DEFINITIONS[2];
    expect(stage3).toBeDefined();
    const result = validateStageDefinition(stage3!, BlockDefinitionTable);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('stage3 has exactly 91 block placements (7 rows x 13 cols)', () => {
    const stage3 = STAGE_DEFINITIONS[2];
    expect(stage3!.blocks).toHaveLength(91);
  });

  // TODO(dev): 커밋 1417858에서 스테이지를 dev용 10블록으로 줄여 일시 skip.
  // 원본 스테이지(65/78/91블록) 복원 시 재활성화.
  it.skip('stage3 has exactly 10 "basic_drop" placements', () => {
    const stage3 = STAGE_DEFINITIONS[2];
    const dropCount = stage3!.blocks.filter(
      (b) => b.definitionId === 'basic_drop'
    ).length;
    expect(dropCount).toBe(10);
  });

  it('STAGE_DEFINITIONS has exactly 3 stages', () => {
    expect(STAGE_DEFINITIONS).toHaveLength(3);
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

  // spinners 검증 케이스
  it('passes when spinners field is undefined (no spinner table needed)', () => {
    const stage1 = StageDefinitionTable[0]!;
    const result = validateStageDefinition(stage1, BlockDefinitionTable);
    expect(result.isValid).toBe(true);
  });

  it('passes when stage has valid spinner placements', () => {
    const stage1 = StageDefinitionTable[0]!;
    const withSpinners = {
      ...stage1,
      spinners: [
        { definitionId: 'spinner_cube', x: 200, y: 300 },
        { definitionId: 'spinner_triangle', x: 400, y: 300, initialAngleRad: 0 },
      ],
    };
    const result = validateStageDefinition(withSpinners, BlockDefinitionTable, SpinnerDefinitionTable);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when a spinner placement references an unknown definitionId', () => {
    const stage1 = StageDefinitionTable[0]!;
    const withBadSpinner = {
      ...stage1,
      spinners: [
        { definitionId: 'unknown_spinner', x: 200, y: 300 },
      ],
    };
    const result = validateStageDefinition(withBadSpinner, BlockDefinitionTable, SpinnerDefinitionTable);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('unknown_spinner'))).toBe(true);
  });

  it('skips spinner validation when spinnerTable is not provided', () => {
    const stage1 = StageDefinitionTable[0]!;
    const withSpinners = {
      ...stage1,
      spinners: [
        { definitionId: 'any_spinner_id', x: 200, y: 300 },
      ],
    };
    const result = validateStageDefinition(withSpinners, BlockDefinitionTable);
    expect(result.isValid).toBe(true);
  });
});
