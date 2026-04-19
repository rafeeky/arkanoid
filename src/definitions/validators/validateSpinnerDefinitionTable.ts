import type { SpinnerDefinition } from '../types/SpinnerDefinition';
import type { ValidationResult } from './ValidationResult';

export function validateSpinnerDefinitionTable(
  table: Record<string, SpinnerDefinition>
): ValidationResult {
  const errors: string[] = [];

  for (const [key, def] of Object.entries(table)) {
    if (def.size <= 0) {
      errors.push(`[${key}] size must be > 0, got ${def.size}`);
    }
    if (!Number.isFinite(def.rotationSpeedRadPerSec)) {
      errors.push(
        `[${key}] rotationSpeedRadPerSec must be finite, got ${def.rotationSpeedRadPerSec}`
      );
    }
    if (!Array.isArray(def.blockCollisionPhases)) {
      errors.push(`[${key}] blockCollisionPhases must be an array`);
    } else if (def.blockCollisionPhases.length === 0) {
      errors.push(`[${key}] blockCollisionPhases must have at least one entry`);
    } else {
      for (const phase of def.blockCollisionPhases) {
        if (!Number.isFinite(phase)) {
          errors.push(`[${key}] blockCollisionPhases contains non-finite value: ${phase}`);
        }
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}
