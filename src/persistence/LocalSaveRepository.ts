import type { ISaveRepository } from './ISaveRepository';
import type { SaveData } from './SaveData';
import { createDefaultSaveData } from './SaveData';

/**
 * localStorage 기반 SaveData 구현체.
 *
 * - localStorage는 브라우저 전용 동기 API이므로 이 파일이
 *   persistence 레이어에서 유일하게 브라우저 API에 의존한다.
 * - 인터페이스가 async이므로 Promise로 감쌈.
 * - QuotaExceeded 등 save 실패는 그대로 reject하여 호출부(AppContext)가 catch/warn.
 * - load 중 JSON 파싱 실패·타입 불일치는 기본값을 반환하고 reject하지 않는다.
 *
 * Unity 매핑: PlayerPrefs / File I/O Adapter (PlayerPrefsAdapter) 구현체와 1:1 대응.
 * 이 클래스를 지우고 PlayerPrefsAdapter로 교체하면 core 로직은 변경 없이 동작한다.
 */
export class LocalSaveRepository implements ISaveRepository {
  constructor(private readonly storageKey: string) {}

  async load(): Promise<SaveData> {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw === null) return createDefaultSaveData();
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'highScore' in parsed &&
        typeof (parsed as Record<string, unknown>).highScore === 'number'
      ) {
        return { highScore: (parsed as SaveData).highScore };
      }
      return createDefaultSaveData();
    } catch {
      return createDefaultSaveData();
    }
  }

  async save(data: SaveData): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      // QuotaExceeded 등은 호출부에서 catch하여 warn 처리.
      throw error;
    }
  }
}
