/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalSaveRepository } from './LocalSaveRepository';

const STORAGE_KEY = 'test.arkanoid.save.v1';

beforeEach(() => {
  localStorage.clear();
});

describe('LocalSaveRepository', () => {
  it('빈 storage에서 load → createDefaultSaveData (highScore=0)', async () => {
    const repo = new LocalSaveRepository(STORAGE_KEY);
    const data = await repo.load();
    expect(data.highScore).toBe(0);
  });

  it('save → load 왕복 값 일치', async () => {
    const repo = new LocalSaveRepository(STORAGE_KEY);
    await repo.save({ highScore: 4200 });
    const data = await repo.load();
    expect(data.highScore).toBe(4200);
  });

  it('손상된 JSON이 저장되어 있으면 load는 기본값 반환', async () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json }');
    const repo = new LocalSaveRepository(STORAGE_KEY);
    const data = await repo.load();
    expect(data.highScore).toBe(0);
  });

  it('highScore 필드 없는 객체가 저장되어 있으면 기본값 반환', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    const repo = new LocalSaveRepository(STORAGE_KEY);
    const data = await repo.load();
    expect(data.highScore).toBe(0);
  });

  it('highScore가 숫자가 아닌 타입이면 기본값 반환', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ highScore: 'not_a_number' }));
    const repo = new LocalSaveRepository(STORAGE_KEY);
    const data = await repo.load();
    expect(data.highScore).toBe(0);
  });

  it('원시값(string)이 저장되어 있으면 기본값 반환', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify('just_a_string'));
    const repo = new LocalSaveRepository(STORAGE_KEY);
    const data = await repo.load();
    expect(data.highScore).toBe(0);
  });

  it('두 인스턴스가 같은 storageKey를 공유한다', async () => {
    const repo1 = new LocalSaveRepository(STORAGE_KEY);
    const repo2 = new LocalSaveRepository(STORAGE_KEY);
    await repo1.save({ highScore: 7777 });
    const data = await repo2.load();
    expect(data.highScore).toBe(7777);
  });

  it('서로 다른 storageKey는 독립적으로 동작한다', async () => {
    const repoA = new LocalSaveRepository('test.key.a');
    const repoB = new LocalSaveRepository('test.key.b');
    await repoA.save({ highScore: 1111 });
    await repoB.save({ highScore: 2222 });
    expect((await repoA.load()).highScore).toBe(1111);
    expect((await repoB.load()).highScore).toBe(2222);
  });
});
