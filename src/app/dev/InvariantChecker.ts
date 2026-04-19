import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';

/**
 * Invariant 위반 기술 타입.
 * type: 위반 분류 식별자 (string literal).
 * message: 사람이 읽을 수 있는 설명.
 * context: 위반 시 진단에 필요한 추가 데이터.
 */
export type InvariantViolation = {
  type: string;
  message: string;
  context: Record<string, unknown>;
};

/**
 * IInvariantChecker 인터페이스.
 * Dev 모드에서 매 틱 후 상태의 불변 조건을 검증한다.
 */
export interface IInvariantChecker {
  /**
   * 현재 상태에서 모든 invariant 검증.
   * 위반 목록을 반환한다. 빈 배열이면 모두 OK.
   */
  check(state: GameplayRuntimeState): InvariantViolation[];
}

/** 블록 반높이/반너비 (렌더링 기준과 일치시키기 위한 상수) */
const BLOCK_HALF_W = 32;
const BLOCK_HALF_H = 12;

/** 공 반지름 */
const BALL_RADIUS = 8;

/** 캔버스 너비 (MovementSystem / CollisionService와 동일) */
const CANVAS_WIDTH = 960;

/**
 * DefaultInvariantChecker: 5가지 invariant를 검증한다.
 *
 * 1. 공 중심은 non-destroyed 블록 body 내부에 있지 않아야 함
 * 2. 공 velocity는 유한 (NaN/Infinity 아님)
 * 3. 공 좌표는 유한 (NaN/Infinity 아님)
 * 4. bar.x ∈ [barWidth/2, CANVAS_WIDTH - barWidth/2]
 * 5. block.remainingHits >= 0
 *
 * 성능: Stage 3 최대 블록 약 100개 × 공 최대 1개 → 100회 AABB 체크.
 * 매 틱 호출해도 실질적 오버헤드 없음.
 */
export class DefaultInvariantChecker implements IInvariantChecker {
  check(state: GameplayRuntimeState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    const activeBalls = state.balls.filter((b) => b.isActive);

    for (const ball of activeBalls) {
      // Invariant 3: 공 좌표 유한 여부
      if (!Number.isFinite(ball.x) || !Number.isFinite(ball.y)) {
        violations.push({
          type: 'BallPositionNonFinite',
          message: `Ball ${ball.id} position contains non-finite value`,
          context: { ballId: ball.id, x: ball.x, y: ball.y },
        });
        // 좌표가 이미 비정상이면 이하 블록 체크 의미 없음 — 건너뜀
        continue;
      }

      // Invariant 2: 공 velocity 유한 여부
      if (!Number.isFinite(ball.vx) || !Number.isFinite(ball.vy)) {
        violations.push({
          type: 'BallVelocityNonFinite',
          message: `Ball ${ball.id} velocity contains non-finite value`,
          context: { ballId: ball.id, vx: ball.vx, vy: ball.vy },
        });
      }

      // Invariant 1: 공 중심이 non-destroyed 블록 내부에 있지 않아야 함
      for (const block of state.blocks) {
        if (block.isDestroyed) continue;

        const insideX = Math.abs(ball.x - block.x) < BLOCK_HALF_W;
        const insideY = Math.abs(ball.y - block.y) < BLOCK_HALF_H;

        if (insideX && insideY) {
          violations.push({
            type: 'BallInsideBlock',
            message: `Ball ${ball.id} center is inside block ${block.id}`,
            context: {
              ballId: ball.id,
              ballX: ball.x,
              ballY: ball.y,
              ballVx: ball.vx,
              ballVy: ball.vy,
              blockId: block.id,
              blockX: block.x,
              blockY: block.y,
              blockDefinitionId: block.definitionId,
              remainingHits: block.remainingHits,
              penetrationX: BLOCK_HALF_W - Math.abs(ball.x - block.x),
              penetrationY: BLOCK_HALF_H - Math.abs(ball.y - block.y),
            },
          });
        }
      }
    }

    // Invariant 4: bar.x ∈ [barWidth/2, CANVAS_WIDTH - barWidth/2]
    const halfBarWidth = state.bar.width / 2;
    const barMinX = halfBarWidth;
    const barMaxX = CANVAS_WIDTH - halfBarWidth;
    if (state.bar.x < barMinX || state.bar.x > barMaxX) {
      violations.push({
        type: 'BarOutOfBounds',
        message: `Bar x=${state.bar.x} is outside allowed range [${barMinX}, ${barMaxX}]`,
        context: {
          barX: state.bar.x,
          barWidth: state.bar.width,
          minAllowed: barMinX,
          maxAllowed: barMaxX,
        },
      });
    }

    // Invariant 5: block.remainingHits >= 0
    for (const block of state.blocks) {
      if (block.remainingHits < 0) {
        violations.push({
          type: 'BlockNegativeHits',
          message: `Block ${block.id} has negative remainingHits: ${block.remainingHits}`,
          context: {
            blockId: block.id,
            remainingHits: block.remainingHits,
            isDestroyed: block.isDestroyed,
            definitionId: block.definitionId,
          },
        });
      }
    }

    return violations;
  }
}

/** InvariantChecker 내부 상수를 외부에서 참조할 수 있도록 export */
export const INVARIANT_CHECKER_CONSTANTS = {
  BLOCK_HALF_W,
  BLOCK_HALF_H,
  BALL_RADIUS,
  CANVAS_WIDTH,
} as const;
