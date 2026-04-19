import type { BlockDefinition } from '../types/BlockDefinition';
import type { ValidationResult } from './ValidationResult';

export function validateBlockDefinition(def: BlockDefinition): ValidationResult {
  const errors: string[] = [];

  if (def.maxHits < 1) {
    errors.push(`[${def.definitionId}] maxHits must be >= 1, got ${def.maxHits}`);
  }
  if (def.score < 0) {
    errors.push(`[${def.definitionId}] score must be >= 0, got ${def.score}`);
  }

  const validDropItemTypes: ReadonlyArray<string> = ['none', 'expand', 'magnet', 'laser'];
  if (!validDropItemTypes.includes(def.dropItemType)) {
    errors.push(
      `[${def.definitionId}] dropItemType must be one of [none, expand, magnet, laser], got ${def.dropItemType}`
    );
  }

  return { isValid: errors.length === 0, errors };
}
