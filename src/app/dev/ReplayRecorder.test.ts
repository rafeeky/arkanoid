import { describe, it, expect } from 'vitest';
import { ReplayRecorder, ReplayPlayer } from './ReplayRecorder';
import type { InputSnapshot } from '../../input/InputSnapshot';

// --- helpers ---

function makeInput(overrides: Partial<InputSnapshot> = {}): InputSnapshot {
  return {
    leftDown: false,
    rightDown: false,
    spaceJustPressed: false,
    ...overrides,
  };
}

// --- ReplayRecorder ---

describe('ReplayRecorder', () => {
  describe('기본 녹화', () => {
    it('초기 frameCount는 0', () => {
      const recorder = new ReplayRecorder(42);
      expect(recorder.getFrameCount()).toBe(0);
    });

    it('record 1회 후 frameCount=1', () => {
      const recorder = new ReplayRecorder(42);
      recorder.record(makeInput(), 0.016);
      expect(recorder.getFrameCount()).toBe(1);
    });

    it('getSession()은 녹화한 순서대로 frames 반환', () => {
      const recorder = new ReplayRecorder(1);
      const input0 = makeInput({ leftDown: true });
      const input1 = makeInput({ rightDown: true });
      const input2 = makeInput({ spaceJustPressed: true });

      recorder.record(input0, 0.016);
      recorder.record(input1, 0.017);
      recorder.record(input2, 0.018);

      const session = recorder.getSession();
      expect(session.frames).toHaveLength(3);
      expect(session.frames[0]!.tickIndex).toBe(0);
      expect(session.frames[0]!.input.leftDown).toBe(true);
      expect(session.frames[1]!.tickIndex).toBe(1);
      expect(session.frames[1]!.input.rightDown).toBe(true);
      expect(session.frames[2]!.tickIndex).toBe(2);
      expect(session.frames[2]!.input.spaceJustPressed).toBe(true);
    });

    it('seed와 initialStageIndex가 session에 포함', () => {
      const recorder = new ReplayRecorder(99, 2);
      const session = recorder.getSession();
      expect(session.seed).toBe(99);
      expect(session.initialStageIndex).toBe(2);
    });

    it('inputSnapshot을 복사하므로 원본 변경이 녹화에 영향 없음', () => {
      const recorder = new ReplayRecorder(1);
      const input = { leftDown: true, rightDown: false, spaceJustPressed: false };
      recorder.record(input, 0.016);
      // 원본 변경
      input.leftDown = false;
      const session = recorder.getSession();
      expect(session.frames[0]!.input.leftDown).toBe(true); // 복사된 값 유지
    });
  });

  describe('환형 버퍼 동작', () => {
    it('maxFrames 초과 시 오래된 프레임 덮어씀', () => {
      const maxFrames = 3;
      const recorder = new ReplayRecorder(1, 0, maxFrames);

      recorder.record(makeInput({ leftDown: true }), 0.016); // tick 0
      recorder.record(makeInput({ rightDown: true }), 0.016); // tick 1
      recorder.record(makeInput({ spaceJustPressed: true }), 0.016); // tick 2
      recorder.record(makeInput(), 0.016); // tick 3 — tick 0 덮어씀

      expect(recorder.getFrameCount()).toBe(maxFrames);

      const session = recorder.getSession();
      expect(session.frames).toHaveLength(maxFrames);

      // tick 0이 사라지고 tick 1, 2, 3만 남음
      const ticks = session.frames.map((f) => f.tickIndex);
      expect(ticks).not.toContain(0);
      expect(ticks).toContain(1);
      expect(ticks).toContain(2);
      expect(ticks).toContain(3);
    });

    it('getFrameCount()는 maxFrames를 초과하지 않음', () => {
      const maxFrames = 5;
      const recorder = new ReplayRecorder(1, 0, maxFrames);
      for (let i = 0; i < 100; i++) {
        recorder.record(makeInput(), 0.016);
      }
      expect(recorder.getFrameCount()).toBe(maxFrames);
    });

    it('환형 버퍼 상태에서 frames 순서는 오름차순', () => {
      const maxFrames = 3;
      const recorder = new ReplayRecorder(1, 0, maxFrames);
      for (let i = 0; i < 5; i++) {
        recorder.record(makeInput(), 0.016);
      }
      const session = recorder.getSession();
      const ticks = session.frames.map((f) => f.tickIndex);
      // [2, 3, 4] 또는 [3, 4, 5] 등 오름차순이어야 함
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!);
      }
    });
  });

  describe('reset', () => {
    it('reset 후 frameCount=0', () => {
      const recorder = new ReplayRecorder(1);
      recorder.record(makeInput(), 0.016);
      recorder.record(makeInput(), 0.016);
      recorder.reset();
      expect(recorder.getFrameCount()).toBe(0);
    });

    it('reset 후 getSession().frames는 빈 배열', () => {
      const recorder = new ReplayRecorder(1);
      recorder.record(makeInput(), 0.016);
      recorder.reset();
      expect(recorder.getSession().frames).toHaveLength(0);
    });
  });

  describe('exportJson / importJson 왕복', () => {
    it('export → import → 동일한 frames 복원', () => {
      const recorder = new ReplayRecorder(77, 1);
      recorder.record(makeInput({ leftDown: true }), 0.016);
      recorder.record(makeInput({ rightDown: true }), 0.016);
      recorder.record(makeInput({ spaceJustPressed: true }), 0.032);

      const json = recorder.exportJson();
      const restored = ReplayRecorder.importJson(json);

      expect(restored.seed).toBe(77);
      expect(restored.initialStageIndex).toBe(1);
      expect(restored.frames).toHaveLength(3);
      expect(restored.frames[0]!.input.leftDown).toBe(true);
      expect(restored.frames[1]!.input.rightDown).toBe(true);
      expect(restored.frames[2]!.input.spaceJustPressed).toBe(true);
      expect(restored.frames[2]!.dt).toBeCloseTo(0.032);
    });

    it('빈 세션 export → import', () => {
      const recorder = new ReplayRecorder(0);
      const restored = ReplayRecorder.importJson(recorder.exportJson());
      expect(restored.frames).toHaveLength(0);
    });

    it('잘못된 JSON → 예외 발생', () => {
      expect(() => ReplayRecorder.importJson('not-json')).toThrow();
    });

    it('구조 불완전한 JSON → 예외 발생', () => {
      expect(() => ReplayRecorder.importJson('{"seed":1}')).toThrow();
    });

    it('프레임 내 InputSnapshot 필드 누락 → 예외 발생', () => {
      const bad = JSON.stringify({
        seed: 1,
        initialStageIndex: 0,
        frames: [{ tickIndex: 0, dt: 0.016, input: { leftDown: true } }], // rightDown/spaceJustPressed 누락
      });
      expect(() => ReplayRecorder.importJson(bad)).toThrow();
    });
  });
});

// --- ReplayPlayer ---

describe('ReplayPlayer', () => {
  function makeSession(frameCount: number) {
    const recorder = new ReplayRecorder(42);
    for (let i = 0; i < frameCount; i++) {
      recorder.record(makeInput(), 0.016);
    }
    return recorder.getSession();
  }

  it('hasNextFrame(): 프레임 있으면 true', () => {
    const player = new ReplayPlayer(makeSession(3));
    expect(player.hasNextFrame()).toBe(true);
  });

  it('hasNextFrame(): 빈 세션은 false', () => {
    const player = new ReplayPlayer(makeSession(0));
    expect(player.hasNextFrame()).toBe(false);
  });

  it('nextFrame(): 순서대로 반환', () => {
    const recorder = new ReplayRecorder(1);
    recorder.record(makeInput({ leftDown: true }), 0.016);
    recorder.record(makeInput({ rightDown: true }), 0.017);
    const player = new ReplayPlayer(recorder.getSession());

    const f0 = player.nextFrame();
    expect(f0.tickIndex).toBe(0);
    expect(f0.input.leftDown).toBe(true);

    const f1 = player.nextFrame();
    expect(f1.tickIndex).toBe(1);
    expect(f1.input.rightDown).toBe(true);
  });

  it('모든 프레임 소진 후 hasNextFrame()=false', () => {
    const player = new ReplayPlayer(makeSession(2));
    player.nextFrame();
    player.nextFrame();
    expect(player.hasNextFrame()).toBe(false);
  });

  it('프레임 소진 후 nextFrame() 호출 → 예외', () => {
    const player = new ReplayPlayer(makeSession(1));
    player.nextFrame();
    expect(() => player.nextFrame()).toThrow();
  });

  it('getCursor()는 소비된 프레임 수와 일치', () => {
    const player = new ReplayPlayer(makeSession(5));
    expect(player.getCursor()).toBe(0);
    player.nextFrame();
    expect(player.getCursor()).toBe(1);
    player.nextFrame();
    player.nextFrame();
    expect(player.getCursor()).toBe(3);
  });

  it('getTotalFrames()는 세션 총 프레임 수 반환', () => {
    const player = new ReplayPlayer(makeSession(7));
    expect(player.getTotalFrames()).toBe(7);
  });

  it('getSeed()와 getInitialStageIndex() 반환', () => {
    const recorder = new ReplayRecorder(55, 2);
    const player = new ReplayPlayer(recorder.getSession());
    expect(player.getSeed()).toBe(55);
    expect(player.getInitialStageIndex()).toBe(2);
  });
});
