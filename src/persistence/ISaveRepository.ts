import type { SaveData } from './SaveData';

/**
 * 저장 데이터 로드/저장 인터페이스.
 *
 * async로 정의한 이유:
 * - localStorage는 동기지만 Unity 포팅 시 File I/O, PlayerPrefs 등 async 가능성 존재.
 * - reject는 구현체가 처리한다 (QuotaExceeded 등). 호출부에서 catch 가능.
 */
export interface ISaveRepository {
  load(): Promise<SaveData>;
  /** Partial 입력 허용 — 구현체는 미지정 필드를 기존 값과 머지하거나 default 적용. */
  save(data: Partial<SaveData>): Promise<void>;
}
