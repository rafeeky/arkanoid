import type { UITextEntry } from '../types/UITextEntry';
import type { ValidationResult } from './ValidationResult';

const REQUIRED_TEXT_IDS: readonly string[] = [
  'txt_title_start',
  'txt_title_highscore',
  'txt_round_01',
  'txt_ready',
  'txt_gameover',
  'txt_retry',
  'txt_item_expand_name',
  'txt_item_expand_desc',
];

export function validateUITextTable(entries: UITextEntry[]): ValidationResult {
  const errors: string[] = [];
  const existingIds = new Set(entries.map((e) => e.textId));

  for (const requiredId of REQUIRED_TEXT_IDS) {
    if (!existingIds.has(requiredId)) {
      errors.push(`UITextTable is missing required key: ${requiredId}`);
    }
  }

  return { isValid: errors.length === 0, errors };
}
