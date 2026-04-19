import type { InputSnapshot } from '../../input/InputSnapshot';

/**
 * 단일 녹화 프레임.
 * tickIndex: 0-based 틱 번호.
 * input: 해당 틱의 InputSnapshot.
 * dt: 해당 틱의 deltaTime (초 단위).
 */
export type ReplayFrame = {
  tickIndex: number;
  input: InputSnapshot;
  dt: number;
};

/**
 * 녹화 세션.
 * seed: 초기 시드. MVP1에서는 RNG 미사용이지만 향후 파워업/스폰 결정론적 재현을 위해 예약.
 * initialStageIndex: 세션 시작 스테이지 인덱스.
 * frames: 녹화된 프레임 배열.
 */
export type ReplaySession = {
  seed: number;
  initialStageIndex: number;
  frames: ReplayFrame[];
};

/**
 * MAX_FRAMES: 최대 녹화 프레임 수.
 * 약 60 fps × 160초 = 9600 → 상한 10000으로 설정.
 * 환형 버퍼(circular buffer) 방식으로 오래된 프레임을 덮어씀.
 */
const DEFAULT_MAX_FRAMES = 10000;

/**
 * ReplayRecorder: 결정론적 재현을 위한 입력 스트림 녹화기.
 *
 * 동작:
 * - record(input, dt)를 매 틱 호출하면 환형 버퍼에 프레임 저장.
 * - 버퍼가 꽉 차면 가장 오래된 프레임부터 덮어씀.
 * - getSession()은 현재 버퍼의 전체 내용을 시간순으로 반환.
 * - exportJson() / importJson()으로 직렬화/역직렬화.
 */
export class ReplayRecorder {
  private readonly maxFrames: number;
  private readonly seed: number;
  private readonly initialStageIndex: number;

  /** 환형 버퍼 */
  private readonly buffer: (ReplayFrame | undefined)[];
  /** 다음 쓰기 위치 */
  private writeHead: number = 0;
  /** 현재 버퍼에 저장된 총 프레임 수 (maxFrames 초과 시 maxFrames로 고정) */
  private totalWritten: number = 0;
  /** 현재 틱 번호 (export 시 frames 배열에서 순서 복원에 사용) */
  private tickIndex: number = 0;

  constructor(seed: number, initialStageIndex: number = 0, maxFrames: number = DEFAULT_MAX_FRAMES) {
    this.seed = seed;
    this.initialStageIndex = initialStageIndex;
    this.maxFrames = maxFrames;
    this.buffer = new Array<ReplayFrame | undefined>(maxFrames);
  }

  /**
   * 현재 틱의 입력과 dt를 녹화한다.
   * 버퍼가 꽉 찬 경우 가장 오래된 프레임을 덮어쓴다.
   */
  record(input: InputSnapshot, dt: number): void {
    const frame: ReplayFrame = {
      tickIndex: this.tickIndex,
      input: { ...input }, // 스냅샷 복사 — 원본 변경 차단
      dt,
    };

    this.buffer[this.writeHead] = frame;
    this.writeHead = (this.writeHead + 1) % this.maxFrames;
    this.totalWritten++;
    this.tickIndex++;
  }

  /**
   * 현재 녹화 버퍼로부터 ReplaySession을 생성한다.
   * frames 배열은 tickIndex 오름차순으로 정렬된다.
   */
  getSession(): ReplaySession {
    const count = Math.min(this.totalWritten, this.maxFrames);
    const frames: ReplayFrame[] = [];

    if (count === 0) {
      return {
        seed: this.seed,
        initialStageIndex: this.initialStageIndex,
        frames,
      };
    }

    if (this.totalWritten <= this.maxFrames) {
      // 버퍼가 아직 꽉 차지 않음 — 0 ~ writeHead-1 순서
      for (let i = 0; i < this.writeHead; i++) {
        const frame = this.buffer[i];
        if (frame !== undefined) frames.push(frame);
      }
    } else {
      // 버퍼가 꽉 참(환형) — writeHead부터 한 바퀴
      for (let i = 0; i < this.maxFrames; i++) {
        const idx = (this.writeHead + i) % this.maxFrames;
        const frame = this.buffer[idx];
        if (frame !== undefined) frames.push(frame);
      }
    }

    return {
      seed: this.seed,
      initialStageIndex: this.initialStageIndex,
      frames,
    };
  }

  /**
   * 현재 세션을 JSON 문자열로 직렬화한다.
   * 사용자가 F2 키를 눌렀을 때 export에 사용한다.
   */
  exportJson(): string {
    return JSON.stringify(this.getSession());
  }

  /**
   * JSON 문자열을 ReplaySession으로 역직렬화한다.
   * 복원된 세션은 ReplayPlayer에 전달해 재현할 수 있다.
   */
  static importJson(json: string): ReplaySession {
    const parsed: unknown = JSON.parse(json);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>)['seed'] !== 'number' ||
      typeof (parsed as Record<string, unknown>)['initialStageIndex'] !== 'number' ||
      !Array.isArray((parsed as Record<string, unknown>)['frames'])
    ) {
      throw new Error('ReplayRecorder.importJson: invalid session JSON structure');
    }

    const raw = parsed as { seed: number; initialStageIndex: number; frames: unknown[] };

    const frames: ReplayFrame[] = raw.frames.map((f, i) => {
      if (
        typeof f !== 'object' ||
        f === null ||
        typeof (f as Record<string, unknown>)['tickIndex'] !== 'number' ||
        typeof (f as Record<string, unknown>)['dt'] !== 'number' ||
        typeof (f as Record<string, unknown>)['input'] !== 'object' ||
        (f as Record<string, unknown>)['input'] === null
      ) {
        throw new Error(`ReplayRecorder.importJson: invalid frame at index ${i}`);
      }

      const frame = f as { tickIndex: number; dt: number; input: Record<string, unknown> };
      const input = frame.input;

      if (
        typeof input['leftDown'] !== 'boolean' ||
        typeof input['rightDown'] !== 'boolean' ||
        typeof input['spaceJustPressed'] !== 'boolean'
      ) {
        throw new Error(`ReplayRecorder.importJson: invalid InputSnapshot at frame index ${i}`);
      }

      return {
        tickIndex: frame.tickIndex,
        dt: frame.dt,
        input: {
          leftDown: input['leftDown'] as boolean,
          rightDown: input['rightDown'] as boolean,
          spaceJustPressed: input['spaceJustPressed'] as boolean,
        },
      };
    });

    return {
      seed: raw.seed,
      initialStageIndex: raw.initialStageIndex,
      frames,
    };
  }

  /** 현재까지 녹화된 프레임 수 */
  getFrameCount(): number {
    return Math.min(this.totalWritten, this.maxFrames);
  }

  /** 녹화를 리셋한다. 새 스테이지/라운드 시작 시 호출. */
  reset(): void {
    this.writeHead = 0;
    this.totalWritten = 0;
    this.tickIndex = 0;
    this.buffer.fill(undefined);
  }
}

/**
 * ReplayPlayer: ReplaySession을 순차적으로 재생한다.
 *
 * 사용처:
 * - 재현 모드에서 GameplayController.tick에 녹화된 입력을 순서대로 전달.
 */
export class ReplayPlayer {
  private readonly session: ReplaySession;
  private cursor: number = 0;

  constructor(session: ReplaySession) {
    this.session = session;
  }

  /** 재생할 다음 프레임이 있으면 true */
  hasNextFrame(): boolean {
    return this.cursor < this.session.frames.length;
  }

  /**
   * 다음 프레임을 반환하고 커서를 전진시킨다.
   * 프레임이 없으면 예외를 던진다 — 호출 전 hasNextFrame()으로 확인할 것.
   */
  nextFrame(): ReplayFrame {
    if (!this.hasNextFrame()) {
      throw new Error('ReplayPlayer.nextFrame: no more frames in session');
    }
    const frame = this.session.frames[this.cursor];
    if (frame === undefined) {
      throw new Error(`ReplayPlayer.nextFrame: frame at cursor ${this.cursor} is undefined`);
    }
    this.cursor++;
    return frame;
  }

  /** 현재 커서 위치 (0-based) */
  getCursor(): number {
    return this.cursor;
  }

  /** 총 프레임 수 */
  getTotalFrames(): number {
    return this.session.frames.length;
  }

  /** 세션 seed 반환 */
  getSeed(): number {
    return this.session.seed;
  }

  /** 세션 initialStageIndex 반환 */
  getInitialStageIndex(): number {
    return this.session.initialStageIndex;
  }
}
