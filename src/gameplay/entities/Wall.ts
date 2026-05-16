/**
 * Wall entity — 플레이필드 경계. 실체 GameObject 가 없는 implicit collider.
 *
 * Unity 매핑: PlayfieldRoot 의 자식 4 개의 BoxCollider2D (left/right/top edge).
 *             현재 TS 에서는 함수 모듈로 표현.
 */

import type { BallState } from '../state/BallState';
import type { BallHitWallFact } from '../systems/CollisionService';
import type { PhysicsConfig } from '../../definitions/types/GameplayConfig';
import {
  PLAYFIELD_WIDTH as CANVAS_WIDTH,
  BALL_RADIUS,
} from '../systems/playfieldLayout';
import { enforceMinAngle } from '../systems/CollisionResolutionService';

/**
 * 벽에 닿은 공의 반사 + 경계 안쪽으로 push-out (overshoot 보정).
 * top wall 만 처리하고 floor 는 별도 (BallHitFloor — life lost).
 */
export function reflectFromBall(
  ball: BallState,
  fact: BallHitWallFact,
  physics: PhysicsConfig,
): BallState {
  let vx = ball.vx;
  let vy = ball.vy;
  let x = ball.x;
  let y = ball.y;

  if (fact.side === 'left') {
    vx = -vx;
    x = BALL_RADIUS + physics.pushOutEpsilon;
  } else if (fact.side === 'right') {
    vx = -vx;
    x = CANVAS_WIDTH - BALL_RADIUS - physics.pushOutEpsilon;
  } else {
    // top
    vy = -vy;
    y = BALL_RADIUS + physics.pushOutEpsilon;
  }

  const enforced = enforceMinAngle(vx, vy, physics.minAngleDeg);
  return { ...ball, x, y, vx: enforced.vx, vy: enforced.vy };
}
