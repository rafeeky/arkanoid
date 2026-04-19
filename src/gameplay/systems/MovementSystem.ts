import type { BarState } from '../state/BarState';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';
import type { ItemDropState } from '../state/ItemDropState';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { BallHitBlockFact } from './CollisionService';
import { sweepBallVsBlocks } from './CollisionService';
import { enforceMinAngle } from './CollisionResolutionService';

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
 * Maximum number of block-collision bounces per tick.
 * Prevents infinite loops in corner cases.
 */
const MAX_BOUNCE_COUNT = 4;

/**
 * Result of moveBallWithCollisions.
 */
export type BallMoveResult = {
  ball: BallState;
  /** BallHitBlock facts accumulated during this tick (0..MAX_BOUNCE_COUNT) */
  blockFacts: BallHitBlockFact[];
};

/**
 * Moves the ball for the given dt using swept AABB collision against the
 * provided block list.
 *
 * Algorithm (per-tick):
 *   1. Compute earliest swept hit among active blocks for remaining dt.
 *   2. If hit within remaining dt:
 *      a. Advance ball to the hit position (t * remaining dt).
 *      b. Reflect the velocity on the hit axis.
 *      c. Accumulate a BallHitBlockFact.
 *      d. Subtract elapsed time from remaining dt and repeat (up to MAX_BOUNCE_COUNT).
 *   3. If no hit, advance ball by the remaining dt and stop.
 *
 * Wall / Bar collisions are intentionally NOT handled here; they continue to
 * be handled by detectCollisions / applyCollisions in the normal pipeline.
 *
 * @param ball    Current ball state (inactive balls are returned unchanged)
 * @param dt      Time delta for this tick (seconds)
 * @param blocks  Current block states (destroyed blocks are skipped)
 */
export function moveBallWithCollisions(
  ball: BallState,
  dt: number,
  blocks: BlockState[],
): BallMoveResult {
  if (!ball.isActive) {
    return { ball, blockFacts: [] };
  }

  const blockFacts: BallHitBlockFact[] = [];
  let current = ball;
  let remaining = dt;

  for (let bounce = 0; bounce < MAX_BOUNCE_COUNT; bounce++) {
    if (remaining <= 0) break;

    const hit = sweepBallVsBlocks(
      current.x,
      current.y,
      current.vx,
      current.vy,
      remaining,
      blocks,
    );

    if (hit === null) {
      // No more block collisions — advance freely for remaining time
      current = {
        ...current,
        x: current.x + current.vx * remaining,
        y: current.y + current.vy * remaining,
      };
      remaining = 0;
      break;
    }

    // Advance ball to the exact contact point
    const elapsed = hit.t * remaining;
    const contactX = current.x + current.vx * elapsed;
    const contactY = current.y + current.vy * elapsed;

    // Reflect velocity on the hit axis and enforce minimum angle
    let newVx = current.vx;
    let newVy = current.vy;
    if (hit.side === 'left' || hit.side === 'right') {
      newVx = -newVx;
    } else {
      newVy = -newVy;
    }
    const enforced = enforceMinAngle(newVx, newVy);
    newVx = enforced.vx;
    newVy = enforced.vy;

    blockFacts.push({
      type: 'BallHitBlock',
      ballId: ball.id,
      blockId: hit.block.id,
      side: hit.side,
    });

    remaining -= elapsed;
    current = { ...current, x: contactX, y: contactY, vx: newVx, vy: newVy };
  }

  // If we hit the bounce cap and there is still time left, just free-advance
  // to prevent the ball from freezing in place.
  if (remaining > 0) {
    current = {
      ...current,
      x: current.x + current.vx * remaining,
      y: current.y + current.vy * remaining,
    };
  }

  return { ball: current, blockFacts };
}

// ---------------------------------------------------------------------------
// Legacy helper kept for tests that import it directly.
// New code should use moveBallWithCollisions.
// ---------------------------------------------------------------------------

/**
 * @deprecated Use moveBallWithCollisions for block-aware movement.
 *
 * Moves a ball using sub-step integration.  The onStep callback is invoked
 * with each candidate position; returning { vx, vy } stops sub-stepping.
 */
export function moveBallSubSteps(
  ball: BallState,
  dt: number,
  onStep: (candidate: BallState) => { vx: number; vy: number } | null,
): BallState {
  if (!ball.isActive) {
    return ball;
  }

  const MAX_STEP_DISTANCE = 12;
  const MAX_SUBSTEP_COUNT = 8;

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
