import { describe, it, expect } from 'vitest';
import { validateUITextTable } from './validateUITextTable';
import { UITextTable } from '../tables/UITextTable';

describe('validateUITextTable', () => {
  it('passes with the full UITextTable', () => {
    const result = validateUITextTable(UITextTable);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when a required key is missing', () => {
    const stripped = UITextTable.filter((e) => e.textId !== 'txt_gameover');
    const result = validateUITextTable(stripped);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('txt_gameover'))).toBe(true);
  });

  it('fails when multiple required keys are missing', () => {
    const stripped = UITextTable.filter(
      (e) => e.textId !== 'txt_title_start' && e.textId !== 'txt_retry'
    );
    const result = validateUITextTable(stripped);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('fails on an empty table', () => {
    const result = validateUITextTable([]);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(8);
  });

  it('UITextTable contains MVP2 round keys', () => {
    const ids = UITextTable.map((e) => e.textId);
    expect(ids).toContain('txt_round_02');
    expect(ids).toContain('txt_round_03');
  });

  it('UITextTable contains MVP2 intro page keys', () => {
    const ids = UITextTable.map((e) => e.textId);
    expect(ids).toContain('txt_intro_page_01');
    expect(ids).toContain('txt_intro_page_02');
    expect(ids).toContain('txt_intro_page_03');
  });

  it('UITextTable contains MVP2 gameclear keys', () => {
    const ids = UITextTable.map((e) => e.textId);
    expect(ids).toContain('txt_gameclear');
    expect(ids).toContain('txt_gameclear_final_score');
    expect(ids).toContain('txt_gameclear_retry');
  });

  it('txt_gameclear_final_score value uses {0} placeholder', () => {
    const entry = UITextTable.find((e) => e.textId === 'txt_gameclear_final_score');
    expect(entry).toBeDefined();
    expect(entry!.value).toContain('{0}');
  });
});
