import { describe, it, expect } from 'vitest';
import { validateIntroSequenceTable } from './validateIntroSequenceTable';
import { IntroSequenceTable } from '../tables/IntroSequenceTable';
import type { IntroSequenceEntry } from '../types/IntroSequenceEntry';

describe('validateIntroSequenceTable', () => {
  it('passes with the full IntroSequenceTable', () => {
    const result = validateIntroSequenceTable(IntroSequenceTable);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('IntroSequenceTable has exactly 3 pages', () => {
    expect(IntroSequenceTable).toHaveLength(3);
  });

  it('IntroSequenceTable pages have sequential pageIndex 0, 1, 2', () => {
    const indices = IntroSequenceTable.map((e) => e.pageIndex);
    expect(indices).toEqual([0, 1, 2]);
  });

  it('fails on an empty table', () => {
    const result = validateIntroSequenceTable([]);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('fails on duplicate pageIndex', () => {
    const entries: IntroSequenceEntry[] = [
      { pageIndex: 0, text: 'FIRST', typingSpeedMs: 40, holdDurationMs: 1500, eraseSpeedMs: 20 },
      { pageIndex: 0, text: 'DUPLICATE', typingSpeedMs: 40, holdDurationMs: 1500, eraseSpeedMs: 20 },
    ];
    const result = validateIntroSequenceTable(entries);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('fails when pageIndex is not sequential from 0', () => {
    const entries: IntroSequenceEntry[] = [
      { pageIndex: 1, text: 'SECOND', typingSpeedMs: 40, holdDurationMs: 1500, eraseSpeedMs: 20 },
      { pageIndex: 2, text: 'THIRD', typingSpeedMs: 40, holdDurationMs: 1500, eraseSpeedMs: 20 },
    ];
    const result = validateIntroSequenceTable(entries);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('sequential'))).toBe(true);
  });

  it('fails when text is empty string', () => {
    const entries: IntroSequenceEntry[] = [
      { pageIndex: 0, text: '', typingSpeedMs: 40, holdDurationMs: 1500, eraseSpeedMs: 20 },
    ];
    const result = validateIntroSequenceTable(entries);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('empty text'))).toBe(true);
  });

  it('fails when text is whitespace only', () => {
    const entries: IntroSequenceEntry[] = [
      { pageIndex: 0, text: '   ', typingSpeedMs: 40, holdDurationMs: 1500, eraseSpeedMs: 20 },
    ];
    const result = validateIntroSequenceTable(entries);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('empty text'))).toBe(true);
  });

  it('fails when typingSpeedMs is zero', () => {
    const entries: IntroSequenceEntry[] = [
      { pageIndex: 0, text: 'TEST', typingSpeedMs: 0, holdDurationMs: 1500, eraseSpeedMs: 20 },
    ];
    const result = validateIntroSequenceTable(entries);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('typingSpeedMs'))).toBe(true);
  });

  it('fails when typingSpeedMs is negative', () => {
    const entries: IntroSequenceEntry[] = [
      { pageIndex: 0, text: 'TEST', typingSpeedMs: -10, holdDurationMs: 1500, eraseSpeedMs: 20 },
    ];
    const result = validateIntroSequenceTable(entries);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('typingSpeedMs'))).toBe(true);
  });

  it('fails when holdDurationMs is negative', () => {
    const entries: IntroSequenceEntry[] = [
      { pageIndex: 0, text: 'TEST', typingSpeedMs: 40, holdDurationMs: -1, eraseSpeedMs: 20 },
    ];
    const result = validateIntroSequenceTable(entries);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('holdDurationMs'))).toBe(true);
  });

  it('fails when eraseSpeedMs is negative', () => {
    const entries: IntroSequenceEntry[] = [
      { pageIndex: 0, text: 'TEST', typingSpeedMs: 40, holdDurationMs: 1500, eraseSpeedMs: -5 },
    ];
    const result = validateIntroSequenceTable(entries);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('eraseSpeedMs'))).toBe(true);
  });

  it('passes a single valid entry', () => {
    const entries: IntroSequenceEntry[] = [
      { pageIndex: 0, text: 'SINGLE PAGE', typingSpeedMs: 40, holdDurationMs: 1500, eraseSpeedMs: 20 },
    ];
    const result = validateIntroSequenceTable(entries);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
