/**
 * Block entity — 자기 좌표/형태/충돌 응답을 소유한다.
 *
 * 성모님 원칙: "오브젝트가 좌표를 소유, 콜리전과 스프라이트가 거기 종속."
 *
 * 좌표 규약 (architecture.md §14-3-x 참조):
 *   (block.x, block.y) 는 블럭 **좌상단** (TS prototype 한정 예외).
 *   Unity 포팅 시 GameObject.transform.position(=center) + BoxCollider2D 로 통일.
 *
 * 이 모듈이 노출하는 두 가지가 collision SSOT:
 *   1. bounds()      — collision 검사와 렌더링 양쪽이 호출해야 하는 단일 진실.
 *   2. reflectFromBall() — 블럭이 공을 만났을 때의 응답. 다른 곳에서 inline 반사하지 말 것.
 */

import type { BlockState } from '../state/BlockState';
import type { BallState } from '../state/BallState';
import type { PhysicsConfig } from '../../definitions/types/GameplayConfig';
import {
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  BALL_RADIUS,
} from '../systems/playfieldLayout';
import { enforceMinAngle } from '../systems/CollisionResolutionService';

export type BlockSide = 'top' | 'bottom' | 'left' | 'right';

export type Bounds = { x: number; y: number; width: number; height: number };

/**
 * 블럭의 collision AABB. 좌상단 (x, y) + 폭/높이.
 * 렌더러는 setOrigin(0, 0) + 이 bounds 로 그려야 시각/충돌이 일치.
 */
export function bounds(block: BlockState): Bounds {
  return { x: block.x, y: block.y, width: BLOCK_WIDTH, height: BLOCK_HEIGHT };
}

/**
 * 블럭에 닿은 공의 반사만 — 속도 벡터 flip + enforceMinAngle.
 * 위치 push-out 은 포함하지 않음. swept 외 경로(resolveBlock fallback) 용.
 */
export function reflectFromBall(
  ball: BallState,
  side: BlockSide,
  physics: PhysicsConfig,
): BallState {
  let vx = ball.vx;
  let vy = ball.vy;
  if (side === 'left' || side === 'right') {
    vx = -vx;
  } else {
    vy = -vy;
  }
  const enforced = enforceMinAngle(vx, vy, physics.minAngleDeg);
  return { ...ball, vx: enforced.vx, vy: enforced.vy };
}

/**
 * 블럭과 공이 만났을 때 전체 응답: 위치 push-out + 속도 반사.
 * swept 루프(MovementSystem) 가 사용. 블럭의 면 기하와 ball radius 로
 * 강제 분리 후 reflect 적용.
 */
export function handleBallCollision(
  ball: BallState,
  side: BlockSide,
  block: BlockState,
  physics: PhysicsConfig,
): BallState {
  let x = ball.x;
  let y = ball.y;
  switch (side) {
    case 'top':
      y = block.y - BALL_RADIUS - physics.pushOutEpsilon;
      break;
    case 'bottom':
      y = block.y + BLOCK_HEIGHT + BALL_RADIUS + physics.pushOutEpsilon;
      break;
    case 'left':
      x = block.x - BALL_RADIUS - physics.pushOutEpsilon;
      break;
    case 'right':
      x = block.x + BLOCK_WIDTH + BALL_RADIUS + physics.pushOutEpsilon;
      break;
  }
  const reflected = reflectFromBall({ ...ball, x, y }, side, physics);
  return reflected;
}
