import { describe, it, expect } from 'vitest';
import { InMemorySaveRepository } from './InMemorySaveRepository';

describe('InMemorySaveRepository', () => {
  it('로드 전 기본값 highScore=0', async () => {
    const repo = new InMemorySaveRepository();
    const data = await repo.load();
    expect(data.highScore).toBe(0);
  });

  it('initialData를 주입하면 해당 값으로 로드됨', async () => {
    const repo = new InMemorySaveRepository({ highScore: 9999 });
    const data = await repo.load();
    expect(data.highScore).toBe(9999);
  });

  it('저장 후 로드 시 값 일치', async () => {
    const repo = new InMemorySaveRepository();
    await repo.save({ highScore: 1234 });
    const data = await repo.load();
    expect(data.highScore).toBe(1234);
  });

  it('여러 번 저장 시 마지막 값이 유지됨', async () => {
    const repo = new InMemorySaveRepository();
    await repo.save({ highScore: 100 });
    await repo.save({ highScore: 500 });
    const data = await repo.load();
    expect(data.highScore).toBe(500);
  });

  it('load는 내부 참조 복사본을 반환한다 (외부 변경 격리)', async () => {
    const repo = new InMemorySaveRepository({ highScore: 42 });
    const data = await repo.load();
    data.highScore = 9999;
    const fresh = await repo.load();
    expect(fresh.highScore).toBe(42);
  });

  it('save는 인자를 복사하여 저장한다 (외부 변경 격리)', async () => {
    const repo = new InMemorySaveRepository();
    const saveData = { highScore: 777 };
    await repo.save(saveData);
    saveData.highScore = 0; // 외부에서 변경
    const data = await repo.load();
    expect(data.highScore).toBe(777);
  });
});
