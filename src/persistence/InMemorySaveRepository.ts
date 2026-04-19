import type { ISaveRepository } from './ISaveRepository';
import type { SaveData } from './SaveData';
import { createDefaultSaveData } from './SaveData';

/**
 * 메모리 내 SaveData 보관 구현체.
 *
 * 용도:
 * - 테스트 주입용 (영속성 불필요)
 * - view-engineer의 LocalSaveRepository가 추가되기 전 placeholder
 *
 * 주의: 인스턴스 수명이 곧 데이터 수명이다. 프로세스 재시작 시 초기화된다.
 */
export class InMemorySaveRepository implements ISaveRepository {
  private data: SaveData;

  constructor(initialData?: SaveData) {
    this.data = initialData ?? createDefaultSaveData();
  }

  load(): Promise<SaveData> {
    return Promise.resolve({ ...this.data });
  }

  save(data: SaveData): Promise<void> {
    this.data = { ...data };
    return Promise.resolve();
  }
}
