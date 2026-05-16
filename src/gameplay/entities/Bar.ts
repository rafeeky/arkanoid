/**
 * Bar entity — 자기 좌표/형태/충돌 응답을 소유.
 *
 * 좌표 규약: (bar.x, bar.y) = 바 **중심**. bar.width 는 가변 (expand 효과로 변동).
 */

import type { BarState } from '../state/BarState';
import type { BallState } from '../state/BallState';
import type { BallHitBarFact } from '../systems/CollisionService';
import type { PhysicsConfig } from '../../definitions/types/GameplayConfig';
import { BAR_HEIGHT, BALL_RADIUS } from '../systems/playfieldLayout';
import { enforceMinAngle } from '../systems/CollisionResolutionService';

export type Bounds = { x: number; y: number; width: number; height: number };

/** 바의 collision AABB. 중심 좌표 기준이므로 좌상단으로 변환해서 반환. */
export function bounds(bar: BarState): Bounds {
  return {
    x: bar.x - bar.width / 2,
    y: bar.y - BAR_HEIGHT / 2,
    width: bar.width,
    height: BAR_HEIGHT,
  };
}

/**
 * 바에 닿은 공의 반사.
 *
 * - vy 는 항상 음수(위로). 어떤 입사각이든 위로 튕긴다.
 * - vx 는 contactX (-1 = 좌 끝, 0 = 중앙, +1 = 우 끝) × speed × physics.barContactBias.
 * - 최소 vy magnitude (speed × 0.3) 를 보장해 수평 트래핑 방지.
 * - enforceMinAngle 적용 후에도 위쪽 방향 유지.
 */
export function reflectFromBall(
  ball: BallState,
  fact: BallHitBarFact,
  physics: PhysicsConfig,
): BallState {
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const rawVx = fact.barContactX * speed * physics.barContactBias;
  const vyMagnitude = Math.sqrt(
    Math.max(speed * speed - rawVx * rawVx, (speed * 0.3) ** 2),
  );
  const enforced = enforceMinAngle(rawVx, -vyMagnitude, physics.minAngleDeg);
  return { ...ball, vx: enforced.vx, vy: -Math.abs(enforced.vy) };
}

/**
 * 바에 공을 부착시킨다 (자석 효과). 공은 바 위 표면 바로 위에 놓이고,
 * 추후 발사 위치 복원을 위해 부착 시점의 x 오프셋을 저장.
 */
export function attachBall(ball: BallState, bar: BarState): BallState {
  return {
    ...ball,
    y: bar.y - BAR_HEIGHT / 2 - BALL_RADIUS,
    vx: 0,
    vy: 0,
    isActive: false,
    attachedOffsetX: ball.x - bar.x,
  };
}
