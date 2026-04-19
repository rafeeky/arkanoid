/**
 * 단일 trail 포인트.
 */
export type TrailPoint = { x: number; y: number };

/**
 * BallTrail: 공의 최근 N 프레임 좌표를 저장하는 환형 버퍼.
 *
 * 용도:
 * - Dev 오버레이에서 공의 궤적(trail)을 렌더링한다.
 * - 반사 패턴 디버깅에 활용한다.
 *
 * 동작:
 * - push(x, y)로 현재 프레임 좌표를 추가한다.
 * - getPoints()는 오래된 것부터 최신 순으로 반환한다.
 * - clear()로 전체 초기화.
 */
export class BallTrail {
  private readonly maxLength: number;
  private readonly buffer: (TrailPoint | undefined)[];
  private writeHead: number = 0;
  private totalWritten: number = 0;

  constructor(maxLength: number = 30) {
    if (maxLength < 1) {
      throw new Error('BallTrail: maxLength must be >= 1');
    }
    this.maxLength = maxLength;
    this.buffer = new Array<TrailPoint | undefined>(maxLength);
  }

  /**
   * 새 좌표를 추가한다.
   * 버퍼가 꽉 차면 가장 오래된 좌표를 덮어쓴다.
   */
  push(x: number, y: number): void {
    this.buffer[this.writeHead] = { x, y };
    this.writeHead = (this.writeHead + 1) % this.maxLength;
    this.totalWritten++;
  }

  /**
   * 저장된 좌표를 오래된 것부터 최신 순으로 반환한다.
   * 반환 배열은 읽기 전용이며, 최대 maxLength개다.
   */
  getPoints(): readonly TrailPoint[] {
    const count = Math.min(this.totalWritten, this.maxLength);
    const result: TrailPoint[] = [];

    if (count === 0) return result;

    if (this.totalWritten <= this.maxLength) {
      // 버퍼가 아직 꽉 차지 않음 — 0 ~ writeHead-1
      for (let i = 0; i < this.writeHead; i++) {
        const point = this.buffer[i];
        if (point !== undefined) result.push(point);
      }
    } else {
      // 버퍼가 꽉 참(환형) — writeHead부터 한 바퀴
      for (let i = 0; i < this.maxLength; i++) {
        const idx = (this.writeHead + i) % this.maxLength;
        const point = this.buffer[idx];
        if (point !== undefined) result.push(point);
      }
    }

    return result;
  }

  /** 버퍼를 초기화한다. 새 라운드 시작 시 호출. */
  clear(): void {
    this.writeHead = 0;
    this.totalWritten = 0;
    this.buffer.fill(undefined);
  }

  /** 현재 저장된 포인트 수 */
  getLength(): number {
    return Math.min(this.totalWritten, this.maxLength);
  }
}
