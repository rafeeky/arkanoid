import type { BarState } from '../state/BarState';
import type { BallState } from '../state/BallState';
import type { ItemDropState } from '../state/ItemDropState';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';

const CANVAS_WIDTH = 960;
const BAR_HEIGHT = 16;

export function moveBar(
  bar: BarState,
  direction: -1 | 0 | 1,
  dt: number,
  config: GameplayConfig,
): BarState {
  if (direction === 0) {
    return bar;
  }
  const newX = bar.x + config.barMoveSpeed * direction * dt;
  const halfWidth = bar.width / 2;
  const clampedX = Math.max(halfWidth, Math.min(CANVAS_WIDTH - halfWidth, newX));
  return { ...bar, x: clampedX };
}

export function moveBall(ball: BallState, dt: number): BallState {
  if (!ball.isActive) {
    return ball;
  }
  return {
    ...ball,
    x: ball.x + ball.vx * dt,
    y: ball.y + ball.vy * dt,
  };
}

/**
 * Maximum distance per sub-step to prevent tunneling.
 * Half of the minimum block dimension (24px height / 2 = 12px).
 */
const MAX_STEP_DISTANCE = 12;
const MAX_SUBSTEP_COUNT = 8;

/**
 * Moves a ball using sub-step integration to prevent tunneling at high speeds
 * or with large dt values (e.g., after a tab switch causing a frame spike).
 *
 * The ball position is advanced in steps no larger than MAX_STEP_DISTANCE.
 * On each sub-step, the onStep callback is invoked with the candidate next
 * position. If the callback returns a velocity override (vx, vy), that
 * override is applied and no further sub-steps are taken (collision handled).
 * If the callback returns null, the step proceeds normally.
 *
 * @param ball        Current ball state (must be active)
 * @param dt          Total time delta for this tick
 * @param onStep      Called for each sub-step with the candidate ball position.
 *                    Return { vx, vy } to intercept the step with a collision
 *                    response, or null to continue.
 * @returns           Final ball state after all sub-steps
 */
export function moveBallSubSteps(
  ball: BallState,
  dt: number,
  onStep: (candidate: BallState) => { vx: number; vy: number } | null,
): BallState {
  if (!ball.isActive) {
    return ball;
  }

  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const totalDistance = speed * dt;

  const rawSteps = totalDistance <= 0 ? 1 : Math.ceil(totalDistance / MAX_STEP_DISTANCE);
  const steps = Math.min(rawSteps, MAX_SUBSTEP_COUNT);
  const stepDt = dt / steps;

  let current = ball;

  for (let i = 0; i < steps; i++) {
    const candidate: BallState = {
      ...current,
      x: current.x + current.vx * stepDt,
      y: current.y + current.vy * stepDt,
    };

    const override = onStep(candidate);
    if (override !== null) {
      // Collision intercepted — apply velocity override and stop sub-stepping
      current = { ...candidate, vx: override.vx, vy: override.vy };
      break;
    }

    current = candidate;
  }

  return current;
}

export function moveItemDrop(item: ItemDropState, dt: number): ItemDropState {
  return {
    ...item,
    y: item.y + item.fallSpeed * dt,
  };
}

export function moveAttachedBallToBar(ball: BallState, bar: BarState): BallState {
  if (ball.isActive) {
    return ball;
  }
  return {
    ...ball,
    x: bar.x,
    y: bar.y - BAR_HEIGHT,
  };
}
