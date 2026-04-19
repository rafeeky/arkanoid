import type { ItemDefinition } from '../types/ItemDefinition';
import type { ValidationResult } from './ValidationResult';

export function validateItemDefinition(def: ItemDefinition): ValidationResult {
  const errors: string[] = [];

  if (def.fallSpeed <= 0) {
    errors.push(`[${def.itemType}] fallSpeed must be > 0, got ${def.fallSpeed}`);
  }
  if (def.expandMultiplier <= 1) {
    errors.push(
      `[${def.itemType}] expandMultiplier must be > 1, got ${def.expandMultiplier}`
    );
  }

  return { isValid: errors.length === 0, errors };
}
