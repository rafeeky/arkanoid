import type { SpinnerDefinition } from '../types/SpinnerDefinition';

export const SpinnerDefinitionTable: Record<string, SpinnerDefinition> = {
  spinner_cube: {
    definitionId: 'spinner_cube',
    kind: 'cube',
    size: 48,
    rotationSpeedRadPerSec: 1.5,
    blockCollisionPhases: [0, Math.PI / 2],
  },
  spinner_triangle: {
    definitionId: 'spinner_triangle',
    kind: 'triangle',
    size: 48,
    rotationSpeedRadPerSec: 1.2,
    blockCollisionPhases: [0],
  },
};
