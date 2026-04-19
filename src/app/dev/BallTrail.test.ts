import { describe, it, expect } from 'vitest';
import { BallTrail } from './BallTrail';

// --- BallTrail ---

describe('BallTrail', () => {
  describe('기본 동작', () => {
    it('초기 상태 — getPoints()는 빈 배열', () => {
      const trail = new BallTrail(30);
      expect(trail.getPoints()).toHaveLength(0);
    });

    it('getLength()는 0', () => {
      const trail = new BallTrail(30);
      expect(trail.getLength()).toBe(0);
    });

    it('push 1회 후 getLength()=1', () => {
      const trail = new BallTrail(30);
      trail.push(100, 200);
      expect(trail.getLength()).toBe(1);
    });

    it('push 후 getPoints()에 좌표 포함', () => {
      const trail = new BallTrail(30);
      trail.push(100, 200);
      const points = trail.getPoints();
      expect(points[0]).toEqual({ x: 100, y: 200 });
    });

    it('push 순서대로 오래된 것 → 최신 순 반환', () => {
      const trail = new BallTrail(30);
      trail.push(1, 10);
      trail.push(2, 20);
      trail.push(3, 30);
      const points = trail.getPoints();
      expect(points[0]).toEqual({ x: 1, y: 10 });
      expect(points[1]).toEqual({ x: 2, y: 20 });
      expect(points[2]).toEqual({ x: 3, y: 30 });
    });
  });

  describe('환형 버퍼 동작', () => {
    it('maxLength 초과 시 오래된 포인트 덮어씀', () => {
      const trail = new BallTrail(3);
      trail.push(1, 10); // 가장 오래됨
      trail.push(2, 20);
      trail.push(3, 30);
      trail.push(4, 40); // (1, 10) 덮어씀

      expect(trail.getLength()).toBe(3);
      const points = trail.getPoints();
      const xs = points.map((p) => p.x);
      expect(xs).not.toContain(1);
      expect(xs).toContain(2);
      expect(xs).toContain(3);
      expect(xs).toContain(4);
    });

    it('환형 버퍼 상태에서 순서는 오래된 것부터 최신 순', () => {
      const trail = new BallTrail(3);
      for (let i = 0; i < 7; i++) {
        trail.push(i, i * 10);
      }
      const points = trail.getPoints();
      // 순서: x값 오름차순이어야 함
      for (let i = 1; i < points.length; i++) {
        expect(points[i]!.x).toBeGreaterThan(points[i - 1]!.x);
      }
    });

    it('getLength()는 maxLength를 초과하지 않음', () => {
      const trail = new BallTrail(5);
      for (let i = 0; i < 100; i++) {
        trail.push(i, i);
      }
      expect(trail.getLength()).toBe(5);
    });

    it('maxLength=1이면 항상 최신 1개만 유지', () => {
      const trail = new BallTrail(1);
      trail.push(1, 10);
      trail.push(2, 20);
      trail.push(3, 30);
      expect(trail.getLength()).toBe(1);
      expect(trail.getPoints()[0]).toEqual({ x: 3, y: 30 });
    });
  });

  describe('clear', () => {
    it('clear 후 getLength()=0', () => {
      const trail = new BallTrail(30);
      trail.push(100, 200);
      trail.push(101, 201);
      trail.clear();
      expect(trail.getLength()).toBe(0);
    });

    it('clear 후 getPoints()는 빈 배열', () => {
      const trail = new BallTrail(30);
      trail.push(100, 200);
      trail.clear();
      expect(trail.getPoints()).toHaveLength(0);
    });

    it('clear 후 다시 push하면 정상 동작', () => {
      const trail = new BallTrail(3);
      trail.push(1, 10);
      trail.clear();
      trail.push(50, 500);
      expect(trail.getLength()).toBe(1);
      expect(trail.getPoints()[0]).toEqual({ x: 50, y: 500 });
    });
  });

  describe('getPoints() 반환값은 읽기 전용 — 수정해도 내부 상태에 영향 없음', () => {
    it('반환된 배열에 원소 추가해도 내부 버퍼 불변', () => {
      const trail = new BallTrail(5);
      trail.push(1, 2);
      const points = trail.getPoints() as { x: number; y: number }[];
      points.push({ x: 999, y: 999 });
      // 다시 getPoints() 호출 시 내부 상태에 영향 없어야 함
      expect(trail.getLength()).toBe(1);
    });
  });

  describe('생성자 유효성', () => {
    it('maxLength < 1이면 예외 발생', () => {
      expect(() => new BallTrail(0)).toThrow();
    });
  });
});
