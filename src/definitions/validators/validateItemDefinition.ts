import type { ItemDefinition } from '../types/ItemDefinition';
import type { ValidationResult } from './ValidationResult';

export function validateItemDefinition(def: ItemDefinition): ValidationResult {
  const errors: string[] = [];

  if (def.fallSpeed <= 0) {
    errors.push(`[${def.itemType}] fallSpeed must be > 0, got ${def.fallSpeed}`);
  }

  if (def.effectType === 'expand') {
    if (def.expandMultiplier === undefined || def.expandMultiplier <= 1) {
      errors.push(
        `[${def.itemType}] expandMultiplier must be > 1, got ${def.expandMultiplier}`
      );
    }
  }

  if (def.effectType === 'magnet') {
    if (def.magnetDurationMs === undefined || def.magnetDurationMs <= 0) {
      errors.push(
        `[${def.itemType}] magnetDurationMs must be > 0, got ${def.magnetDurationMs}`
      );
    }
  }

  if (def.effectType === 'laser') {
    if (def.laserCooldownMs === undefined || def.laserCooldownMs <= 0) {
      errors.push(
        `[${def.itemType}] laserCooldownMs must be > 0, got ${def.laserCooldownMs}`
      );
    }
    if (def.laserShotCount === undefined || def.laserShotCount <= 0) {
      errors.push(
        `[${def.itemType}] laserShotCount must be > 0, got ${def.laserShotCount}`
      );
    }
  }

  return { isValid: errors.length === 0, errors };
}
