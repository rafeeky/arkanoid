import type { StageDefinition } from '../types/StageDefinition';
import type { BlockDefinition } from '../types/BlockDefinition';
import type { ValidationResult } from './ValidationResult';

const GRID_ROWS = 5;
const GRID_COLS = 13;

export function validateStageDefinition(
  stage: StageDefinition,
  blockTable: Record<string, BlockDefinition>
): ValidationResult {
  const errors: string[] = [];
  const seenCoords = new Set<string>();

  for (const placement of stage.blocks) {
    const { row, col, definitionId } = placement;

    if (row < 0 || row >= GRID_ROWS) {
      errors.push(
        `[${stage.stageId}] block at (row=${row}, col=${col}) has row out of range [0, ${GRID_ROWS - 1}]`
      );
    }
    if (col < 0 || col >= GRID_COLS) {
      errors.push(
        `[${stage.stageId}] block at (row=${row}, col=${col}) has col out of range [0, ${GRID_COLS - 1}]`
      );
    }

    const coordKey = `${row},${col}`;
    if (seenCoords.has(coordKey)) {
      errors.push(
        `[${stage.stageId}] duplicate block placement at (row=${row}, col=${col})`
      );
    } else {
      seenCoords.add(coordKey);
    }

    if (!(definitionId in blockTable)) {
      errors.push(
        `[${stage.stageId}] block at (row=${row}, col=${col}) references unknown definitionId: ${definitionId}`
      );
    }
  }

  return { isValid: errors.length === 0, errors };
}
