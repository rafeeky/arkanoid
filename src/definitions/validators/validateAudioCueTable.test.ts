import { describe, it, expect } from 'vitest';
import { validateAudioCueTable } from './validateAudioCueTable';
import { AudioCueTable } from '../tables/AudioCueTable';

describe('validateAudioCueTable', () => {
  it('passes with the full AudioCueTable', () => {
    const result = validateAudioCueTable(AudioCueTable);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when a required event mapping is missing', () => {
    const stripped = AudioCueTable.filter((e) => e.eventType !== 'BlockHit');
    const result = validateAudioCueTable(stripped);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('BlockHit'))).toBe(true);
  });

  it('fails when multiple required events are missing', () => {
    const stripped = AudioCueTable.filter(
      (e) => e.eventType !== 'EnteredTitle' && e.eventType !== 'EnteredGameOver'
    );
    const result = validateAudioCueTable(stripped);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('fails on an empty table', () => {
    const result = validateAudioCueTable([]);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(8);
  });
});
