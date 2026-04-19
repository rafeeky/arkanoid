import { describe, it, expect } from 'vitest';
import { CollisionLog } from './CollisionLog';
import type { CollisionLogEntry } from './CollisionLog';

// --- helpers ---

function makeEntry(tick: number, kind: CollisionLogEntry['target']['kind'] = 'block'): CollisionLogEntry {
  if (kind === 'block') {
    return {
      tick,
      time: tick * 16,
      ball: { x: 100 + tick, y: 200, vx: 300, vy: -400 },
      target: { kind, id: `blk-${tick}` },
    };
  }
  return {
    tick,
    time: tick * 16,
    ball: { x: 100 + tick, y: 200, vx: 300, vy: -400 },
    target: { kind },
  };
}

// --- CollisionLog ---

describe('CollisionLog', () => {
  describe('기본 동작', () => {
    it('초기 상태 — getRecent()는 빈 배열', () => {
      const log = new CollisionLog(10);
      expect(log.getRecent()).toHaveLength(0);
    });

    it('getSize()는 0', () => {
      const log = new CollisionLog(10);
      expect(log.getSize()).toBe(0);
    });

    it('push 1회 후 getSize()=1', () => {
      const log = new CollisionLog(10);
      log.push(makeEntry(0));
      expect(log.getSize()).toBe(1);
    });

    it('push 후 getRecent()에 항목 포함', () => {
      const log = new CollisionLog(10);
      const entry = makeEntry(0, 'wall');
      log.push(entry);
      const recent = log.getRecent();
      expect(recent).toHaveLength(1);
      expect(recent[0]!.tick).toBe(0);
      expect(recent[0]!.target.kind).toBe('wall');
    });

    it('getRecent()는 오래된 것부터 최신 순 반환', () => {
      const log = new CollisionLog(10);
      log.push(makeEntry(0));
      log.push(makeEntry(1));
      log.push(makeEntry(2));
      const recent = log.getRecent();
      expect(recent[0]!.tick).toBe(0);
      expect(recent[1]!.tick).toBe(1);
      expect(recent[2]!.tick).toBe(2);
    });
  });

  describe('환형 버퍼 동작', () => {
    it('maxSize 초과 시 오래된 항목 덮어씀', () => {
      const log = new CollisionLog(3);
      log.push(makeEntry(0)); // 가장 오래됨
      log.push(makeEntry(1));
      log.push(makeEntry(2));
      log.push(makeEntry(3)); // tick 0 덮어씀

      expect(log.getSize()).toBe(3);
      const recent = log.getRecent();
      const ticks = recent.map((e) => e.tick);
      expect(ticks).not.toContain(0);
      expect(ticks).toContain(1);
      expect(ticks).toContain(2);
      expect(ticks).toContain(3);
    });

    it('환형 버퍼 상태에서 순서는 오름차순(tick)', () => {
      const log = new CollisionLog(3);
      for (let i = 0; i < 7; i++) {
        log.push(makeEntry(i));
      }
      const recent = log.getRecent();
      for (let i = 1; i < recent.length; i++) {
        expect(recent[i]!.tick).toBeGreaterThan(recent[i - 1]!.tick);
      }
    });

    it('getSize()는 maxSize를 초과하지 않음', () => {
      const log = new CollisionLog(5);
      for (let i = 0; i < 100; i++) {
        log.push(makeEntry(i));
      }
      expect(log.getSize()).toBe(5);
    });

    it('maxSize=1이면 항상 최신 1개만 유지', () => {
      const log = new CollisionLog(1);
      log.push(makeEntry(0));
      log.push(makeEntry(1));
      log.push(makeEntry(2));
      expect(log.getSize()).toBe(1);
      expect(log.getRecent()[0]!.tick).toBe(2);
    });
  });

  describe('clear', () => {
    it('clear 후 getSize()=0', () => {
      const log = new CollisionLog(10);
      log.push(makeEntry(0));
      log.push(makeEntry(1));
      log.clear();
      expect(log.getSize()).toBe(0);
    });

    it('clear 후 getRecent()는 빈 배열', () => {
      const log = new CollisionLog(10);
      log.push(makeEntry(0));
      log.clear();
      expect(log.getRecent()).toHaveLength(0);
    });

    it('clear 후 다시 push하면 정상 동작', () => {
      const log = new CollisionLog(3);
      log.push(makeEntry(0));
      log.clear();
      log.push(makeEntry(5));
      expect(log.getSize()).toBe(1);
      expect(log.getRecent()[0]!.tick).toBe(5);
    });
  });

  describe('entry 다양한 target kind', () => {
    it('wall, bar, floor, block 모두 push 가능', () => {
      const log = new CollisionLog(10);
      log.push(makeEntry(0, 'wall'));
      log.push(makeEntry(1, 'bar'));
      log.push(makeEntry(2, 'floor'));
      log.push(makeEntry(3, 'block'));
      const recent = log.getRecent();
      const kinds = recent.map((e) => e.target.kind);
      expect(kinds).toContain('wall');
      expect(kinds).toContain('bar');
      expect(kinds).toContain('floor');
      expect(kinds).toContain('block');
    });
  });

  describe('생성자 유효성', () => {
    it('maxSize < 1이면 예외 발생', () => {
      expect(() => new CollisionLog(0)).toThrow();
    });
  });
});
