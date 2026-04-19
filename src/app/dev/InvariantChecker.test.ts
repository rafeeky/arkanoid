import { describe, it, expect } from 'vitest';
import { DefaultInvariantChecker, INVARIANT_CHECKER_CONSTANTS } from './InvariantChecker';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';

const { BLOCK_HALF_W, BLOCK_HALF_H, CANVAS_WIDTH } = INVARIANT_CHECKER_CONSTANTS;

// --- helpers ---

function makeState(overrides: Partial<GameplayRuntimeState> = {}): GameplayRuntimeState {
  return {
    session: { currentStageIndex: 0, score: 0, lives: 3, highScore: 0 },
    bar: { x: 480, y: 540, width: 64, moveSpeed: 300, activeEffect: 'none' },
    balls: [{ id: 'ball-0', x: 480, y: 300, vx: 200, vy: -300, isActive: true }],
    blocks: [
      { id: 'blk-0', x: 100, y: 100, remainingHits: 1, isDestroyed: false, definitionId: 'def-0' },
    ],
    itemDrops: [],
    isStageCleared: false,
    ...overrides,
  };
}

// --- InvariantChecker ---

describe('DefaultInvariantChecker', () => {
  const checker = new DefaultInvariantChecker();

  describe('정상 상태 — 위반 없음', () => {
    it('기본 상태에서 위반 0건', () => {
      const state = makeState();
      expect(checker.check(state)).toHaveLength(0);
    });

    it('비활성 공은 블록 내부에 있어도 위반 없음 (isActive=false)', () => {
      // 비활성 공은 invariant 체크 대상 아님
      const state = makeState({
        balls: [{ id: 'ball-0', x: 100, y: 100, vx: 0, vy: 0, isActive: false }],
      });
      expect(checker.check(state)).toHaveLength(0);
    });

    it('destroyed 블록은 공 위치 체크 제외', () => {
      const state = makeState({
        balls: [{ id: 'ball-0', x: 100, y: 100, vx: 200, vy: -300, isActive: true }],
        blocks: [
          { id: 'blk-0', x: 100, y: 100, remainingHits: 0, isDestroyed: true, definitionId: 'def-0' },
        ],
      });
      // destroyed block 내부에 공이 있어도 위반 없음
      expect(checker.check(state)).toHaveLength(0);
    });

    it('bar가 정확히 경계에 있으면 위반 없음', () => {
      const halfBar = 32; // width=64
      const stateLeft = makeState({ bar: { x: halfBar, y: 540, width: 64, moveSpeed: 300, activeEffect: 'none' } });
      const stateRight = makeState({ bar: { x: CANVAS_WIDTH - halfBar, y: 540, width: 64, moveSpeed: 300, activeEffect: 'none' } });
      expect(checker.check(stateLeft)).toHaveLength(0);
      expect(checker.check(stateRight)).toHaveLength(0);
    });

    it('remainingHits=0이면 위반 없음 (0은 정상)', () => {
      const state = makeState({
        blocks: [{ id: 'blk-0', x: 100, y: 100, remainingHits: 0, isDestroyed: false, definitionId: 'def-0' }],
      });
      expect(checker.check(state)).toHaveLength(0);
    });
  });

  describe('Invariant 1: 공이 non-destroyed 블록 내부에 있으면 위반', () => {
    it('공 중심이 블록 중심과 동일 — BallInsideBlock 위반', () => {
      const state = makeState({
        balls: [{ id: 'ball-0', x: 100, y: 100, vx: 200, vy: -300, isActive: true }],
        blocks: [{ id: 'blk-0', x: 100, y: 100, remainingHits: 1, isDestroyed: false, definitionId: 'def-0' }],
      });
      const violations = checker.check(state);
      expect(violations.some((v) => v.type === 'BallInsideBlock')).toBe(true);
    });

    it('공이 블록 경계 바깥 — 위반 없음', () => {
      // 공이 블록 오른쪽 경계 밖에 있음
      const state = makeState({
        balls: [{ id: 'ball-0', x: 100 + BLOCK_HALF_W + 1, y: 100, vx: 200, vy: -300, isActive: true }],
        blocks: [{ id: 'blk-0', x: 100, y: 100, remainingHits: 1, isDestroyed: false, definitionId: 'def-0' }],
      });
      expect(checker.check(state)).toHaveLength(0);
    });

    it('공이 블록과 x만 겹치고 y는 벗어남 — 위반 없음', () => {
      const state = makeState({
        balls: [{ id: 'ball-0', x: 100, y: 100 + BLOCK_HALF_H + 1, vx: 200, vy: -300, isActive: true }],
        blocks: [{ id: 'blk-0', x: 100, y: 100, remainingHits: 1, isDestroyed: false, definitionId: 'def-0' }],
      });
      expect(checker.check(state)).toHaveLength(0);
    });

    it('위반 context에 풍부한 정보 포함', () => {
      const state = makeState({
        balls: [{ id: 'ball-0', x: 100, y: 100, vx: 200, vy: -300, isActive: true }],
        blocks: [{ id: 'blk-0', x: 100, y: 100, remainingHits: 2, isDestroyed: false, definitionId: 'def-A' }],
      });
      const violations = checker.check(state);
      const v = violations.find((v) => v.type === 'BallInsideBlock');
      expect(v).toBeDefined();
      expect(v!.context['ballId']).toBe('ball-0');
      expect(v!.context['blockId']).toBe('blk-0');
      expect(v!.context['ballVx']).toBe(200);
      expect(v!.context['ballVy']).toBe(-300);
    });
  });

  describe('Invariant 2: velocity 비유한 값', () => {
    it('vx가 NaN이면 BallVelocityNonFinite 위반', () => {
      const state = makeState({
        balls: [{ id: 'ball-0', x: 480, y: 300, vx: NaN, vy: -300, isActive: true }],
      });
      const violations = checker.check(state);
      expect(violations.some((v) => v.type === 'BallVelocityNonFinite')).toBe(true);
    });

    it('vy가 Infinity이면 BallVelocityNonFinite 위반', () => {
      const state = makeState({
        balls: [{ id: 'ball-0', x: 480, y: 300, vx: 200, vy: Infinity, isActive: true }],
      });
      const violations = checker.check(state);
      expect(violations.some((v) => v.type === 'BallVelocityNonFinite')).toBe(true);
    });

    it('vx=-Infinity이면 BallVelocityNonFinite 위반', () => {
      const state = makeState({
        balls: [{ id: 'ball-0', x: 480, y: 300, vx: -Infinity, vy: -300, isActive: true }],
      });
      const violations = checker.check(state);
      expect(violations.some((v) => v.type === 'BallVelocityNonFinite')).toBe(true);
    });
  });

  describe('Invariant 3: 공 좌표 비유한 값', () => {
    it('x가 NaN이면 BallPositionNonFinite 위반', () => {
      const state = makeState({
        balls: [{ id: 'ball-0', x: NaN, y: 300, vx: 200, vy: -300, isActive: true }],
      });
      const violations = checker.check(state);
      expect(violations.some((v) => v.type === 'BallPositionNonFinite')).toBe(true);
    });

    it('y가 Infinity이면 BallPositionNonFinite 위반', () => {
      const state = makeState({
        balls: [{ id: 'ball-0', x: 480, y: Infinity, vx: 200, vy: -300, isActive: true }],
      });
      const violations = checker.check(state);
      expect(violations.some((v) => v.type === 'BallPositionNonFinite')).toBe(true);
    });

    it('좌표가 비유한이면 블록 내부 체크 스킵 (중복 위반 방지)', () => {
      // 좌표가 NaN이면 블록 위치 비교 자체가 의미 없으므로 BallInsideBlock은 발생하지 않아야 함
      const state = makeState({
        balls: [{ id: 'ball-0', x: NaN, y: 300, vx: 200, vy: -300, isActive: true }],
        blocks: [{ id: 'blk-0', x: 100, y: 100, remainingHits: 1, isDestroyed: false, definitionId: 'def-0' }],
      });
      const violations = checker.check(state);
      expect(violations.some((v) => v.type === 'BallInsideBlock')).toBe(false);
      expect(violations.some((v) => v.type === 'BallPositionNonFinite')).toBe(true);
    });
  });

  describe('Invariant 4: bar.x 범위 검증', () => {
    it('bar.x가 barWidth/2보다 작으면 BarOutOfBounds 위반', () => {
      const state = makeState({
        bar: { x: 10, y: 540, width: 64, moveSpeed: 300, activeEffect: 'none' },
      });
      const violations = checker.check(state);
      expect(violations.some((v) => v.type === 'BarOutOfBounds')).toBe(true);
    });

    it('bar.x가 CANVAS_WIDTH - barWidth/2보다 크면 BarOutOfBounds 위반', () => {
      const state = makeState({
        bar: { x: CANVAS_WIDTH - 10, y: 540, width: 64, moveSpeed: 300, activeEffect: 'none' },
      });
      const violations = checker.check(state);
      expect(violations.some((v) => v.type === 'BarOutOfBounds')).toBe(true);
    });

    it('BarOutOfBounds context에 범위 정보 포함', () => {
      const state = makeState({
        bar: { x: 0, y: 540, width: 64, moveSpeed: 300, activeEffect: 'none' },
      });
      const violations = checker.check(state);
      const v = violations.find((v) => v.type === 'BarOutOfBounds');
      expect(v).toBeDefined();
      expect(v!.context['barX']).toBe(0);
      expect(v!.context['barWidth']).toBe(64);
      expect(typeof v!.context['minAllowed']).toBe('number');
      expect(typeof v!.context['maxAllowed']).toBe('number');
    });
  });

  describe('Invariant 5: block.remainingHits >= 0', () => {
    it('remainingHits=-1이면 BlockNegativeHits 위반', () => {
      const state = makeState({
        blocks: [{ id: 'blk-0', x: 100, y: 100, remainingHits: -1, isDestroyed: false, definitionId: 'def-0' }],
      });
      const violations = checker.check(state);
      expect(violations.some((v) => v.type === 'BlockNegativeHits')).toBe(true);
    });

    it('여러 블록 중 하나만 음수 — 해당 블록만 위반', () => {
      const state = makeState({
        blocks: [
          { id: 'blk-0', x: 100, y: 100, remainingHits: 2, isDestroyed: false, definitionId: 'def-0' },
          { id: 'blk-1', x: 200, y: 100, remainingHits: -2, isDestroyed: false, definitionId: 'def-0' },
        ],
      });
      const violations = checker.check(state);
      const neg = violations.filter((v) => v.type === 'BlockNegativeHits');
      expect(neg).toHaveLength(1);
      expect(neg[0]!.context['blockId']).toBe('blk-1');
    });
  });

  describe('복합 위반', () => {
    it('여러 invariant 동시 위반 — 모두 반환', () => {
      const state = makeState({
        balls: [{ id: 'ball-0', x: 480, y: 300, vx: NaN, vy: Infinity, isActive: true }],
        bar: { x: 0, y: 540, width: 64, moveSpeed: 300, activeEffect: 'none' },
        blocks: [
          { id: 'blk-0', x: 100, y: 100, remainingHits: -1, isDestroyed: false, definitionId: 'def-0' },
        ],
      });
      const violations = checker.check(state);
      const types = violations.map((v) => v.type);
      expect(types).toContain('BallVelocityNonFinite');
      expect(types).toContain('BarOutOfBounds');
      expect(types).toContain('BlockNegativeHits');
    });
  });
});
