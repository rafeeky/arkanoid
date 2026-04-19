import type { AudioCueEntry } from '../definitions/types/AudioCueEntry';

/**
 * AudioCueResolver — eventType → AudioCueEntry[] 매핑 조회.
 *
 * AudioCueTable(Definition 계층)을 받아 이벤트 타입에서 cue 목록을 반환한다.
 * 현재 테이블은 1:1 매핑이지만, 미래 1:N 확장을 위해 배열 반환.
 *
 * Phaser/DOM 미사용 — 순수 lookup 로직.
 *
 * Unity 매핑: 순수 C# 클래스. AudioBridge MonoBehaviour 에서 주입받아 사용.
 */
export class AudioCueResolver {
  private readonly table: readonly AudioCueEntry[];
  private readonly indexByEventType: Map<string, AudioCueEntry[]>;

  constructor(table: readonly AudioCueEntry[]) {
    this.table = table;
    this.indexByEventType = new Map<string, AudioCueEntry[]>();

    for (const entry of this.table) {
      const existing = this.indexByEventType.get(entry.eventType);
      if (existing) {
        existing.push(entry);
      } else {
        this.indexByEventType.set(entry.eventType, [entry]);
      }
    }
  }

  /**
   * 주어진 eventType에 해당하는 모든 AudioCueEntry를 반환한다.
   * 매핑이 없으면 빈 배열을 반환한다.
   */
  resolveCueIds(eventType: string): AudioCueEntry[] {
    return this.indexByEventType.get(eventType) ?? [];
  }
}
