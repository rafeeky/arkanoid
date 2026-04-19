/**
 * 단일 충돌 로그 항목.
 *
 * tick: 발생한 틱 번호.
 * time: 발생 시각 (ms). 외부에서 주입한 clock 값 사용.
 * ball: 충돌 시점 공 상태 스냅샷.
 * target: 충돌 대상 기술.
 */
export type CollisionLogEntry = {
  tick: number;
  time: number;
  ball: { x: number; y: number; vx: number; vy: number };
  target: {
    kind: 'block' | 'wall' | 'bar' | 'floor';
    id?: string;
    side?: string;
  };
};

/**
 * CollisionLog: 최근 N개의 충돌 이벤트를 저장하는 환형 버퍼.
 *
 * 용도:
 * - Dev 오버레이에서 최근 충돌 정보를 표시한다.
 * - 버그 재현 시 충돌 시퀀스를 추적한다.
 *
 * 동작:
 * - push() 로 새 항목을 추가한다.
 * - 버퍼가 꽉 차면 가장 오래된 항목을 덮어쓴다.
 * - getRecent()는 추가 순서(오래된 것 → 최신) 로 반환한다.
 */
export class CollisionLog {
  private readonly maxSize: number;
  private readonly buffer: (CollisionLogEntry | undefined)[];
  private writeHead: number = 0;
  private totalWritten: number = 0;

  constructor(maxSize: number = 10) {
    if (maxSize < 1) {
      throw new Error('CollisionLog: maxSize must be >= 1');
    }
    this.maxSize = maxSize;
    this.buffer = new Array<CollisionLogEntry | undefined>(maxSize);
  }

  /**
   * 새 충돌 항목을 추가한다.
   * 버퍼가 꽉 찬 경우 가장 오래된 항목을 덮어쓴다.
   */
  push(entry: CollisionLogEntry): void {
    this.buffer[this.writeHead] = entry;
    this.writeHead = (this.writeHead + 1) % this.maxSize;
    this.totalWritten++;
  }

  /**
   * 최근 기록된 충돌 항목들을 오래된 것부터 최신 순으로 반환한다.
   * 반환 배열은 읽기 전용이며, 최대 maxSize개다.
   */
  getRecent(): readonly CollisionLogEntry[] {
    const count = Math.min(this.totalWritten, this.maxSize);
    const result: CollisionLogEntry[] = [];

    if (count === 0) return result;

    if (this.totalWritten <= this.maxSize) {
      // 버퍼가 아직 꽉 차지 않음 — 0 ~ writeHead-1
      for (let i = 0; i < this.writeHead; i++) {
        const entry = this.buffer[i];
        if (entry !== undefined) result.push(entry);
      }
    } else {
      // 버퍼가 꽉 참(환형) — writeHead부터 한 바퀴
      for (let i = 0; i < this.maxSize; i++) {
        const idx = (this.writeHead + i) % this.maxSize;
        const entry = this.buffer[idx];
        if (entry !== undefined) result.push(entry);
      }
    }

    return result;
  }

  /** 버퍼를 초기화한다. */
  clear(): void {
    this.writeHead = 0;
    this.totalWritten = 0;
    this.buffer.fill(undefined);
  }

  /** 현재 저장된 항목 수 */
  getSize(): number {
    return Math.min(this.totalWritten, this.maxSize);
  }
}
