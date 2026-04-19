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
const BALL_RADIUS = 8;
const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;

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
 * Distance the ball is pushed away from a block face after reflection.
 *
 * After a swept collision the ball's centre lands exactly on the expanded
 * AABB boundary.  That is numerically on the edge — the next sweep iteration
 * (or the next frame) may see tExit > 0 again and produce a spurious second
 * hit that flips the velocity back, causing the ball to stall inside the
 * block.  Nudging by this epsilon guarantees strict separation so the
 * subsequent sweep returns null for the same face.
 *
 * Value is intentionally tiny (< 0.5px) so it is imperceptible during play.
 */
const BLOCK_PUSH_OUT_EPSILON = 0.5;

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
  // Track which blocks have already been reflected this tick to prevent the
  // same block from flipping the velocity more than once (sign-flip bug).
  const hitBlockIds = new Set<string>();
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

    // Skip this block if we have already bounced off it this tick.
    // This prevents the t=0 re-entry loop where the same block flips the
    // velocity twice and restores the original direction.
    if (hitBlockIds.has(hit.block.id)) {
      // Advance freely for remaining time (treat as if no hit)
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

    // Position correction: push the ball out by epsilon along the collision
    // normal so the centre is strictly outside the expanded AABB boundary.
    // Without this nudge, the centre lands exactly on the boundary and the
    // very next sweep iteration sees tExit > 0 → spurious second hit.
    let pushX = contactX;
    let pushY = contactY;
    switch (hit.side) {
      case 'top':    pushY = contactY - BLOCK_PUSH_OUT_EPSILON; break;
      case 'bottom': pushY = contactY + BLOCK_PUSH_OUT_EPSILON; break;
      case 'left':   pushX = contactX - BLOCK_PUSH_OUT_EPSILON; break;
      case 'right':  pushX = contactX + BLOCK_PUSH_OUT_EPSILON; break;
    }

    blockFacts.push({
      type: 'BallHitBlock',
      ballId: ball.id,
      blockId: hit.block.id,
      side: hit.side,
    });

    hitBlockIds.add(hit.block.id);
    remaining -= elapsed;
    current = { ...current, x: pushX, y: pushY, vx: newVx, vy: newVy };
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

// ---------------------------------------------------------------------------
// Post-tick sanity check: ball-block separation
// ---------------------------------------------------------------------------

/**
 * Result of sanityCheckBallBlockSeparation.
 */
export type SanityCheckResult = {
  ball: BallState;
  /** True if the ball was found inside one or more blocks and was corrected. */
  wasInside: boolean;
  /**
   * A BallHitBlockFact for the first block the ball was pushed out of.
   * Present only when wasInside=true. This fact can be injected into the
   * collision pipeline so block hit/destroy logic still runs.
   */
  collisionFact?: BallHitBlockFact;
};

/**
 * Computes the overlap rectangle between the ball centre and a block AABB.
 * The "overlap" here is the penetration depth on each axis (positive = overlap).
 * Returns null when the ball centre is outside the block AABB.
 *
 * We compare the ball centre (not the expanded AABB) against the block AABB
 * because this check is a last-resort correction: if the ball centre itself
 * is inside the block geometry we have a confirmed tunnel.
 */
function computeBallCenterBlockOverlap(
  ball: BallState,
  block: BlockState,
): { overlapX: number; overlapY: number; cx: number; cy: number } | null {
  const bx = block.x;
  const by = block.y;
  const bRight = bx + BLOCK_WIDTH;
  const bBottom = by + BLOCK_HEIGHT;

  if (ball.x <= bx || ball.x >= bRight) return null;
  if (ball.y <= by || ball.y >= bBottom) return null;

  const cx = bx + BLOCK_WIDTH / 2;
  const cy = by + BLOCK_HEIGHT / 2;
  // Penetration depths on each axis (distance to nearest face)
  const overlapX = BLOCK_WIDTH / 2 - Math.abs(ball.x - cx);
  const overlapY = BLOCK_HEIGHT / 2 - Math.abs(ball.y - cy);

  return { overlapX, overlapY, cx, cy };
}

/**
 * Post-tick defensive check.
 *
 * After all movement and swept collision have been applied, this function
 * verifies that the ball centre does not lie inside any active block's AABB.
 * If it does (which should be rare but can happen due to floating-point
 * accumulation or extreme dt), the ball is pushed out along the shallowest
 * overlap axis and its velocity is reflected on that axis.
 *
 * This is intentionally a last-resort safety net, not the primary collision
 * system. It does NOT replace sweepBallVsBlocks.
 *
 * Returns the (possibly corrected) ball state and a flag indicating whether
 * a correction was needed. If corrected, a BallHitBlockFact is also returned
 * so the caller can run normal block hit/destroy logic for the affected block.
 *
 * Only the first overlapping block is corrected per call. If the correction
 * causes an overlap with a second block that will be resolved on the next tick.
 */
export function sanityCheckBallBlockSeparation(
  ball: BallState,
  blocks: readonly BlockState[],
): SanityCheckResult {
  if (!ball.isActive) {
    return { ball, wasInside: false };
  }

  for (const block of blocks) {
    if (block.isDestroyed) continue;

    const overlap = computeBallCenterBlockOverlap(ball, block);
    if (overlap === null) continue;

    // Ball centre is inside the block. Determine push-out direction from the
    // shallowest penetration axis.
    const { overlapX, overlapY, cx, cy } = overlap;

    let newVx = ball.vx;
    let newVy = ball.vy;
    let newX = ball.x;
    let newY = ball.y;
    let side: 'left' | 'right' | 'top' | 'bottom';

    if (overlapX <= overlapY) {
      // Push out along x-axis
      if (ball.x < cx) {
        // Ball centre is left of block centre → push left
        newX = block.x - BALL_RADIUS - BLOCK_PUSH_OUT_EPSILON;
        side = 'left';
      } else {
        // Push right
        newX = block.x + BLOCK_WIDTH + BALL_RADIUS + BLOCK_PUSH_OUT_EPSILON;
        side = 'right';
      }
      newVx = -newVx;
    } else {
      // Push out along y-axis
      if (ball.y < cy) {
        // Ball centre is above block centre → push upward
        newY = block.y - BALL_RADIUS - BLOCK_PUSH_OUT_EPSILON;
        side = 'top';
      } else {
        // Push downward
        newY = block.y + BLOCK_HEIGHT + BALL_RADIUS + BLOCK_PUSH_OUT_EPSILON;
        side = 'bottom';
      }
      newVy = -newVy;
    }

    const enforced = enforceMinAngle(newVx, newVy);
    const correctedBall: BallState = {
      ...ball,
      x: newX,
      y: newY,
      vx: enforced.vx,
      vy: enforced.vy,
    };
    const collisionFact: BallHitBlockFact = {
      type: 'BallHitBlock',
      ballId: ball.id,
      blockId: block.id,
      side,
    };

    return { ball: correctedBall, wasInside: true, collisionFact };
  }

  return { ball, wasInside: false };
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
