import type { AudioCueEntry } from '../types/AudioCueEntry';
import type { ValidationResult } from './ValidationResult';

const REQUIRED_EVENT_TYPES: readonly string[] = [
  'EnteredTitle',
  'EnteredRoundIntro',
  'BlockHit',
  'BlockDestroyed',
  'ItemCollected',
  'LifeLost',
  'EnteredGameOver',
  'UiConfirm',
];

export function validateAudioCueTable(entries: AudioCueEntry[]): ValidationResult {
  const errors: string[] = [];
  const mappedEvents = new Set(entries.map((e) => e.eventType));

  for (const required of REQUIRED_EVENT_TYPES) {
    if (!mappedEvents.has(required)) {
      errors.push(`AudioCueTable is missing mapping for event: ${required}`);
    }
  }

  return { isValid: errors.length === 0, errors };
}
