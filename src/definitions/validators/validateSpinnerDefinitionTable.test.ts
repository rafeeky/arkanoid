import { describe, it, expect } from 'vitest';
import { validateSpinnerDefinitionTable } from './validateSpinnerDefinitionTable';
import { SpinnerDefinitionTable } from '../tables/SpinnerDefinitionTable';

describe('validateSpinnerDefinitionTable', () => {
  it('passes with the full SpinnerDefinitionTable', () => {
    const result = validateSpinnerDefinitionTable(SpinnerDefinitionTable);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('SpinnerDefinitionTable contains spinner_cube and spinner_triangle', () => {
    expect(SpinnerDefinitionTable['spinner_cube']).toBeDefined();
    expect(SpinnerDefinitionTable['spinner_triangle']).toBeDefined();
  });

  it('spinner_cube has blockCollisionPhases [0, PI/2]', () => {
    const cube = SpinnerDefinitionTable['spinner_cube']!;
    expect(cube.blockCollisionPhases).toHaveLength(2);
    expect(cube.blockCollisionPhases[0]).toBe(0);
    expect(cube.blockCollisionPhases[1]).toBeCloseTo(Math.PI / 2);
  });

  it('spinner_triangle has blockCollisionPhases [0]', () => {
    const tri = SpinnerDefinitionTable['spinner_triangle']!;
    expect(tri.blockCollisionPhases).toHaveLength(1);
    expect(tri.blockCollisionPhases[0]).toBe(0);
  });

  it('fails when size is 0', () => {
    const result = validateSpinnerDefinitionTable({
      bad_spinner: {
        definitionId: 'bad_spinner',
        kind: 'cube',
        size: 0,
        rotationSpeedRadPerSec: 1.5,
        blockCollisionPhases: [0],
      },
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('size'))).toBe(true);
  });

  it('fails when rotationSpeedRadPerSec is Infinity', () => {
    const result = validateSpinnerDefinitionTable({
      bad_spinner: {
        definitionId: 'bad_spinner',
        kind: 'triangle',
        size: 48,
        rotationSpeedRadPerSec: Infinity,
        blockCollisionPhases: [0],
      },
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('rotationSpeedRadPerSec'))).toBe(true);
  });

  it('fails when rotationSpeedRadPerSec is NaN', () => {
    const result = validateSpinnerDefinitionTable({
      bad_spinner: {
        definitionId: 'bad_spinner',
        kind: 'cube',
        size: 48,
        rotationSpeedRadPerSec: NaN,
        blockCollisionPhases: [0],
      },
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('rotationSpeedRadPerSec'))).toBe(true);
  });

  it('fails when blockCollisionPhases is empty', () => {
    const result = validateSpinnerDefinitionTable({
      bad_spinner: {
        definitionId: 'bad_spinner',
        kind: 'cube',
        size: 48,
        rotationSpeedRadPerSec: 1.5,
        blockCollisionPhases: [],
      },
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('blockCollisionPhases'))).toBe(true);
  });

  it('fails when blockCollisionPhases contains NaN', () => {
    const result = validateSpinnerDefinitionTable({
      bad_spinner: {
        definitionId: 'bad_spinner',
        kind: 'cube',
        size: 48,
        rotationSpeedRadPerSec: 1.5,
        blockCollisionPhases: [NaN],
      },
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('blockCollisionPhases'))).toBe(true);
  });

  it('passes with an empty table', () => {
    const result = validateSpinnerDefinitionTable({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
