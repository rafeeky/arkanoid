/**
 * Door entity — 자기 좌표/형태/충돌 응답을 소유.
 *
 * 상단 테두리 위에 배치. Checkpoint B: 닫힌 상태 충돌만 구현 (BorderBlock 과 동일).
 * Checkpoint C 에서 opening 애니, D 에서 스피너 spawn 연결.
 *
 * 공 충돌 동작 (확정 결정):
 *   - 공은 항상 차단. 모든 phase 에서 반사.
 *   - opened phase 에서도 공은 통과 못 함 (오직 스피너만 통과).
 */

import type { BallState } from '../state/BallState';
import type { DoorState } from '../state/DoorState';
import type { PhysicsConfig } from '../../definitions/types/GameplayConfig';
import { BORDER_LENGTH, BORDER_THICKNESS, BALL_RADIUS } from '../systems/playfieldLayout';
import { enforceMinAngle } from '../systems/CollisionResolutionService';

export type DoorSide = 'top' | 'bottom' | 'left' | 'right';

export type Bounds = { x: number; y: number; width: number; height: number };

/** opening phase 의 총 길이 (ms). 디자이너 튜닝 가능하면 config 로 빼는 것 고려. */
export const OPENING_DURATION_MS = 600;

/** Door 의 AABB. 공이 항상 차단되므로 phase 와 무관하게 풀 사이즈 반환. */
export function bounds(d: DoorState): Bounds {
  return { x: d.x, y: d.y, width: BORDER_LENGTH, height: BORDER_THICKNESS };
}

/** 공 차단 여부. 사용자 결정: opened 에서도 공은 차단 (스피너만 통과). */
export function blocksBall(_d: DoorState): boolean {
  return true;
}

/** opening 진행도 (0..1). closed=0, opened=1, opening 은 elapsedMs/duration. */
export function openingProgress(d: DoorState): number {
  if (d.phase === 'closed') return 0;
  if (d.phase === 'opened') return 1;
  return Math.min(1, d.openingElapsedMs / OPENING_DURATION_MS);
}

/**
 * 매 틱 호출. phase 진행:
 *   closed → opening (즉시 전이, 스테이지 시작과 동시에)
 *   opening → opened (openingElapsedMs >= OPENING_DURATION_MS)
 *   opened → opened (변화 없음)
 *
 * @param dtMs Δt in milliseconds
 */
export function tickAnimation(d: DoorState, dtMs: number): DoorState {
  switch (d.phase) {
    case 'closed':
      return { ...d, phase: 'opening', openingElapsedMs: 0 };
    case 'opening': {
      const elapsed = d.openingElapsedMs + dtMs;
      if (elapsed >= OPENING_DURATION_MS) {
        return { ...d, phase: 'opened', openingElapsedMs: OPENING_DURATION_MS };
      }
      return { ...d, openingElapsedMs: elapsed };
    }
    case 'opened':
      return d;
  }
}

/** 스피너 차단 여부. opening 까지는 차단, opened 부터 통과 허용. */
export function blocksSpinner(d: DoorState): boolean {
  return d.phase !== 'opened';
}

/**
 * 공이 Door 에 부딪혔을 때 응답: push-out + 반사.
 * BorderBlock 과 동일한 구조 (horizontal AABB).
 */
export function handleBallCollision(
  ball: BallState,
  side: DoorSide,
  door: DoorState,
  physics: PhysicsConfig,
): BallState {
  let x = ball.x;
  let y = ball.y;
  switch (side) {
    case 'top':
      y = door.y - BALL_RADIUS - physics.pushOutEpsilon;
      break;
    case 'bottom':
      y = door.y + BORDER_THICKNESS + BALL_RADIUS + physics.pushOutEpsilon;
      break;
    case 'left':
      x = door.x - BALL_RADIUS - physics.pushOutEpsilon;
      break;
    case 'right':
      x = door.x + BORDER_LENGTH + BALL_RADIUS + physics.pushOutEpsilon;
      break;
  }
  let vx = ball.vx;
  let vy = ball.vy;
  if (side === 'left' || side === 'right') vx = -vx;
  else vy = -vy;
  const enforced = enforceMinAngle(vx, vy, physics.minAngleDeg);
  return { ...ball, x, y, vx: enforced.vx, vy: enforced.vy };
}
