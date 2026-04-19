import type { IntroSequenceEntry } from '../types/IntroSequenceEntry';
import type { ValidationResult } from './ValidationResult';

export function validateIntroSequenceTable(
  entries: IntroSequenceEntry[]
): ValidationResult {
  const errors: string[] = [];

  if (entries.length === 0) {
    errors.push('IntroSequenceTable must have at least one entry');
    return { isValid: false, errors };
  }

  // pageIndex가 0부터 연속적인지 검증
  const sorted = [...entries].sort((a, b) => a.pageIndex - b.pageIndex);
  const seenIndices = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!;

    if (seenIndices.has(entry.pageIndex)) {
      errors.push(
        `IntroSequenceTable has duplicate pageIndex: ${entry.pageIndex}`
      );
    }
    seenIndices.add(entry.pageIndex);

    if (entry.pageIndex !== i) {
      errors.push(
        `IntroSequenceTable pageIndex must be sequential starting from 0; expected ${i}, got ${entry.pageIndex}`
      );
    }

    if (entry.text.trim().length === 0) {
      errors.push(
        `IntroSequenceTable entry at pageIndex ${entry.pageIndex} has empty text`
      );
    }

    if (entry.typingSpeedMs <= 0) {
      errors.push(
        `IntroSequenceTable entry at pageIndex ${entry.pageIndex} has non-positive typingSpeedMs: ${entry.typingSpeedMs}`
      );
    }

    if (entry.holdDurationMs <= 0) {
      errors.push(
        `IntroSequenceTable entry at pageIndex ${entry.pageIndex} has non-positive holdDurationMs: ${entry.holdDurationMs}`
      );
    }

    if (entry.eraseSpeedMs <= 0) {
      errors.push(
        `IntroSequenceTable entry at pageIndex ${entry.pageIndex} has non-positive eraseSpeedMs: ${entry.eraseSpeedMs}`
      );
    }
  }

  return { isValid: errors.length === 0, errors };
}
