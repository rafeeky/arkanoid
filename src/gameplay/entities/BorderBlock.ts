/**
 * BorderBlock entity — 자기 좌표/형태/충돌 응답을 소유한다.
 *
 * 깨지지 않는 벽. 일반 Block 과 유사한 AABB 충돌이지만 HP 감소 / 파괴 없음.
 *
 * 좌표 규약: (border.x, border.y) = 좌상단. orientation 에 따라 폭/높이가 결정됨.
 */

import type { BallState } from '../state/BallState';
import type { BorderBlockState } from '../state/BorderBlockState';
import type { PhysicsConfig } from '../../definitions/types/GameplayConfig';
import {
  BORDER_LENGTH,
  BORDER_THICKNESS,
  BALL_RADIUS,
} from '../systems/playfieldLayout';
import { enforceMinAngle } from '../systems/CollisionResolutionService';

export type BorderSide = 'top' | 'bottom' | 'left' | 'right';

export type Bounds = { x: number; y: number; width: number; height: number };

/**
 * BorderBlock 의 collision AABB.
 * horizontal: BORDER_LENGTH × BORDER_THICKNESS
 * vertical:   BORDER_THICKNESS × BORDER_LENGTH
 */
export function bounds(b: BorderBlockState): Bounds {
  if (b.orientation === 'horizontal') {
    return { x: b.x, y: b.y, width: BORDER_LENGTH, height: BORDER_THICKNESS };
  }
  return { x: b.x, y: b.y, width: BORDER_THICKNESS, height: BORDER_LENGTH };
}

/**
 * 공이 BorderBlock 에 부딪혔을 때의 응답: push-out + 반사.
 * HP 감소 없음 (깨지지 않는 벽).
 *
 * Block.handleBallCollision 과 동일한 구조지만 bounds 가 orientation 에
 * 따라 다르므로 width/height 를 동적으로 사용한다.
 */
export function handleBallCollision(
  ball: BallState,
  side: BorderSide,
  border: BorderBlockState,
  physics: PhysicsConfig,
): BallState {
  const { width, height } = bounds(border);

  let x = ball.x;
  let y = ball.y;
  switch (side) {
    case 'top':
      y = border.y - BALL_RADIUS - physics.pushOutEpsilon;
      break;
    case 'bottom':
      y = border.y + height + BALL_RADIUS + physics.pushOutEpsilon;
      break;
    case 'left':
      x = border.x - BALL_RADIUS - physics.pushOutEpsilon;
      break;
    case 'right':
      x = border.x + width + BALL_RADIUS + physics.pushOutEpsilon;
      break;
  }

  let vx = ball.vx;
  let vy = ball.vy;
  if (side === 'left' || side === 'right') {
    vx = -vx;
  } else {
    vy = -vy;
  }
  const enforced = enforceMinAngle(vx, vy, physics.minAngleDeg);
  return { ...ball, x, y, vx: enforced.vx, vy: enforced.vy };
}
