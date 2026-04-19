import type { BarState } from '../state/BarState';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';
import type { ItemDropState } from '../state/ItemDropState';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { BallHitBlockFact, BallHitWallFact } from './CollisionService';
import { enforceMinAngle } from './CollisionResolutionService';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const BAR_HEIGHT = 16;
const BALL_RADIUS = 8;
const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;

/**
 * Distance the ball is pushed away from a block face or wall after reflection.
 * Small enough to be imperceptible; large enough to guarantee strict separation.
 */
const PUSH_OUT_EPSILON = 0.5;

/**
 * Sub-step size in pixels.
 * At 4px per step, a ball travelling at 2000 px/s at 30 fps (66px total) uses
 * ceil(66/4) = 17 steps — tunnelling is geometrically impossible for block
 * thicknesses >= 4px (BLOCK_HEIGHT=24, BLOCK_WIDTH=64).
 */
const SUB_STEP_SIZE = 4;

/**
 * Hard cap on the number of sub-steps per tick.
 * At SUB_STEP_SIZE=4 this caps total distance at 32*4=128px per tick,
 * which handles speeds up to 128/0.033 ≈ 3900 px/s at 30fps.
 * If a ball somehow exceeds this (should not happen in MVP1), the remaining
 * motion is dropped to avoid an infinite loop.
 */
const MAX_SUB_STEPS = 32;

/**
 * Moves a ball by (vx*dt, vy*dt) without any collision checks.
 * Used for simple position preview and by legacy tests.
 */
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

// ---------------------------------------------------------------------------
// Circle-AABB overlap test
// ---------------------------------------------------------------------------

/**
 * Returns true when the circle (cx, cy, radius) overlaps the AABB defined
 * by (bx, by, bx+BLOCK_WIDTH, by+BLOCK_HEIGHT).
 * Uses the nearest-point-on-AABB approach.
 */
function circleOverlapsBlock(cx: number, cy: number, block: BlockState): boolean {
  const nearestX = Math.max(block.x, Math.min(cx, block.x + BLOCK_WIDTH));
  const nearestY = Math.max(block.y, Math.min(cy, block.y + BLOCK_HEIGHT));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= BALL_RADIUS * BALL_RADIUS;
}

// ---------------------------------------------------------------------------
// findOverlappingBlock
// ---------------------------------------------------------------------------

/**
 * Returns the BEST overlapping non-destroyed block for the ball, or null.
 *
 * "Best" = the block whose body centre is closest to the ball centre.
 * This matters at the 4px inter-block gap, where the ball (radius 8) can
 * overlap two or more adjacent blocks simultaneously.  Iterating in array
 * order and returning the first match destroyed whichever block happened
 * to appear first in stage data — almost never the block the player saw
 * the ball land on.  Choosing by centre-distance picks the block the ball
 * is most deeply inside, which matches user perception and keeps the
 * subsequent entry-side / push-out logic pointed at the correct face.
 */
function findOverlappingBlock(
  cx: number,
  cy: number,
  blocks: readonly BlockState[],
  skipIds: ReadonlySet<string>,
): BlockState | null {
  let best: BlockState | null = null;
  let bestDistSq = Infinity;
  for (const block of blocks) {
    if (block.isDestroyed) continue;
    if (skipIds.has(block.id)) continue;
    if (!circleOverlapsBlock(cx, cy, block)) continue;

    const bcx = block.x + BLOCK_WIDTH / 2;
    const bcy = block.y + BLOCK_HEIGHT / 2;
    const dx = cx - bcx;
    const dy = cy - bcy;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = block;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// determineEntrySide
// ---------------------------------------------------------------------------

/**
 * Determines which face of the block the ball entered based on the movement
 * vector from prev to curr.
 *
 * Algorithm: expanded AABB slab method on the prev→curr segment.
 * The "last-entry axis" (largest entry time) determines the face.
 * This is more reliable than centre-based heuristics.
 */
function determineEntrySide(
  prevX: number,
  prevY: number,
  currX: number,
  currY: number,
  block: BlockState,
): 'top' | 'bottom' | 'left' | 'right' {
  const dx = currX - prevX;
  const dy = currY - prevY;

  // Expanded AABB boundaries (ball centre space)
  const exLeft   = block.x - BALL_RADIUS;
  const exRight  = block.x + BLOCK_WIDTH  + BALL_RADIUS;
  const exTop    = block.y - BALL_RADIUS;
  const exBottom = block.y + BLOCK_HEIGHT + BALL_RADIUS;

  // Compute entry times along x-axis
  let txEntry = -Infinity;
  let xSide: 'left' | 'right' = 'left';
  if (dx > 0) {
    txEntry = (exLeft  - prevX) / dx;
    xSide = 'left';
  } else if (dx < 0) {
    txEntry = (exRight - prevX) / dx;
    xSide = 'right';
  }

  // Compute entry times along y-axis
  let tyEntry = -Infinity;
  let ySide: 'top' | 'bottom' = 'top';
  if (dy > 0) {
    tyEntry = (exTop    - prevY) / dy;
    ySide = 'top';
  } else if (dy < 0) {
    tyEntry = (exBottom - prevY) / dy;
    ySide = 'bottom';
  }

  // The axis with the larger (later) entry time is the constraining axis —
  // this is the face the ball truly entered through.
  // Ties are broken toward y (top/bottom) which is the more common case for
  // a game like Arkanoid where the ball predominantly moves at oblique angles.
  if (txEntry > tyEntry) {
    return xSide;
  }
  return ySide;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type BallMoveResult = {
  ball: BallState;
  blockFacts: BallHitBlockFact[];
  wallFacts: BallHitWallFact[];
};

// ---------------------------------------------------------------------------
// moveBallWithCollisions — sub-step AABB
// ---------------------------------------------------------------------------

/**
 * Moves the ball for the given dt using sub-step integration.
 *
 * Algorithm:
 *   1. Divide dt into steps of SUB_STEP_SIZE pixels (capped at MAX_SUB_STEPS).
 *   2. Each sub-step:
 *      a. Advance position by (vx * stepDt, vy * stepDt).
 *      b. Handle wall collisions (reflect + push).
 *      c. Handle one block collision (overlap → entry-side → reflect + push).
 *         hitThisSubstep prevents the same block from being processed twice
 *         within a single sub-step, but the set is reset between sub-steps so
 *         a ball skimming a corner can touch the same block on consecutive steps.
 *   3. Return ball + accumulated facts.
 *
 * Guarantees:
 *   - Ball centre never travels more than SUB_STEP_SIZE pixels between checks,
 *     so tunnelling is impossible for any block thicker than SUB_STEP_SIZE.
 *   - Every block hit is properly reflected and pushed out before continuing.
 *
 * @param ball    Current ball state (inactive balls returned unchanged)
 * @param dt      Time delta in seconds
 * @param blocks  Current block states
 */
export function moveBallWithCollisions(
  ball: BallState,
  dt: number,
  blocks: readonly BlockState[],
): BallMoveResult {
  if (!ball.isActive) {
    return { ball, blockFacts: [], wallFacts: [] };
  }

  const blockFacts: BallHitBlockFact[] = [];
  const wallFacts: BallHitWallFact[] = [];
  // Tracks blocks that have already been recorded as hit (so we don't emit
  // duplicate facts for the same block across multiple sub-steps).
  // NOTE: this does NOT prevent a block from being reflected again if the ball
  // genuinely approaches it a second time from a different angle across steps.
  // This set is only used for fact deduplication; collision *detection* (the
  // circle overlap test) is the ground truth.
  const hitBlockIds = new Set<string>();

  // Compute number of sub-steps
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const totalDist = speed * dt;
  const steps = Math.max(1, Math.min(MAX_SUB_STEPS, Math.ceil(totalDist / SUB_STEP_SIZE)));
  const stepDt = dt / steps;

  let current = ball;

  for (let step = 0; step < steps; step++) {
    const prev = current;

    // a. Advance
    current = {
      ...current,
      x: current.x + current.vx * stepDt,
      y: current.y + current.vy * stepDt,
    };

    // b. Wall collisions
    if (current.x - BALL_RADIUS < 0) {
      current = {
        ...current,
        x: BALL_RADIUS + PUSH_OUT_EPSILON,
        vx: Math.abs(current.vx),
      };
      wallFacts.push({ type: 'BallHitWall', ballId: ball.id, side: 'left' });
    } else if (current.x + BALL_RADIUS > CANVAS_WIDTH) {
      current = {
        ...current,
        x: CANVAS_WIDTH - BALL_RADIUS - PUSH_OUT_EPSILON,
        vx: -Math.abs(current.vx),
      };
      wallFacts.push({ type: 'BallHitWall', ballId: ball.id, side: 'right' });
    }

    if (current.y - BALL_RADIUS < 0) {
      current = {
        ...current,
        y: BALL_RADIUS + PUSH_OUT_EPSILON,
        vy: Math.abs(current.vy),
      };
      wallFacts.push({ type: 'BallHitWall', ballId: ball.id, side: 'top' });
    }

    // c. Block collision — process at most one block per sub-step.
    // hitThisSubstep prevents the same block from triggering twice within
    // the same substep (e.g. after push-out lands the ball back in overlap).
    const hitThisSubstep = new Set<string>();
    const hitBlock = findOverlappingBlock(current.x, current.y, blocks, hitThisSubstep);
    if (hitBlock !== null) {
      hitThisSubstep.add(hitBlock.id);

      const side = determineEntrySide(prev.x, prev.y, current.x, current.y, hitBlock);

      // Position correction: push ball outside block face
      let newX = current.x;
      let newY = current.y;
      switch (side) {
        case 'top':
          newY = hitBlock.y - BALL_RADIUS - PUSH_OUT_EPSILON;
          break;
        case 'bottom':
          newY = hitBlock.y + BLOCK_HEIGHT + BALL_RADIUS + PUSH_OUT_EPSILON;
          break;
        case 'left':
          newX = hitBlock.x - BALL_RADIUS - PUSH_OUT_EPSILON;
          break;
        case 'right':
          newX = hitBlock.x + BLOCK_WIDTH + BALL_RADIUS + PUSH_OUT_EPSILON;
          break;
      }

      // Velocity reflection
      let newVx = current.vx;
      let newVy = current.vy;
      if (side === 'top' || side === 'bottom') {
        newVy = -newVy;
      } else {
        newVx = -newVx;
      }

      const enforced = enforceMinAngle(newVx, newVy);
      newVx = enforced.vx;
      newVy = enforced.vy;

      current = { ...current, x: newX, y: newY, vx: newVx, vy: newVy };

      // Emit fact only once per block per full tick
      if (!hitBlockIds.has(hitBlock.id)) {
        hitBlockIds.add(hitBlock.id);
        blockFacts.push({
          type: 'BallHitBlock',
          ballId: ball.id,
          blockId: hitBlock.id,
          side,
        });
      }
    }
  }

  return { ball: current, blockFacts, wallFacts };
}

// ---------------------------------------------------------------------------
// Post-tick sanity check: ball-block separation
// ---------------------------------------------------------------------------

export type SanityCheckResult = {
  ball: BallState;
  wasInside: boolean;
  collisionFact?: BallHitBlockFact;
};

/**
 * Post-tick defensive check.
 *
 * After all movement and collision have been applied, this verifies that
 * the ball centre does not lie inside any active block's AABB.
 * If it does, the ball is pushed out along the shallowest overlap axis and
 * its velocity is reflected on that axis.
 *
 * This is a last-resort safety net, not the primary collision system.
 * Only the first overlapping block is corrected per call.
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

    const bx = block.x;
    const by = block.y;
    const bRight  = bx + BLOCK_WIDTH;
    const bBottom = by + BLOCK_HEIGHT;

    // Strict centre-inside check (no radius — this is a last resort)
    if (ball.x <= bx || ball.x >= bRight)  continue;
    if (ball.y <= by || ball.y >= bBottom) continue;

    // Penetration depth on each axis
    const cx = bx + BLOCK_WIDTH  / 2;
    const cy = by + BLOCK_HEIGHT / 2;
    const overlapX = BLOCK_WIDTH  / 2 - Math.abs(ball.x - cx);
    const overlapY = BLOCK_HEIGHT / 2 - Math.abs(ball.y - cy);

    let newVx = ball.vx;
    let newVy = ball.vy;
    let newX  = ball.x;
    let newY  = ball.y;
    let side: 'left' | 'right' | 'top' | 'bottom';

    if (overlapX <= overlapY) {
      // Push out along x-axis
      if (ball.x < cx) {
        newX = bx - BALL_RADIUS - PUSH_OUT_EPSILON;
        side = 'left';
        if (newVx > 0) newVx = -newVx;
      } else {
        newX = bRight + BALL_RADIUS + PUSH_OUT_EPSILON;
        side = 'right';
        if (newVx < 0) newVx = -newVx;
      }
    } else {
      // Push out along y-axis
      if (ball.y < cy) {
        newY = by - BALL_RADIUS - PUSH_OUT_EPSILON;
        side = 'top';
        if (newVy > 0) newVy = -newVy;
      } else {
        newY = bBottom + BALL_RADIUS + PUSH_OUT_EPSILON;
        side = 'bottom';
        if (newVy < 0) newVy = -newVy;
      }
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

    if (typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production') {
      console.warn(
        `[SANITY CHECK] ball ${ball.id} inside block ${block.id} at` +
        ` (${ball.x.toFixed(2)}, ${ball.y.toFixed(2)})` +
        ` vx=${ball.vx.toFixed(1)} vy=${ball.vy.toFixed(1)}` +
        ` pushed to (${newX.toFixed(2)}, ${newY.toFixed(2)}) side=${side}`,
      );
    }

    return { ball: correctedBall, wasInside: true, collisionFact };
  }

  return { ball, wasInside: false };
}

// ---------------------------------------------------------------------------
// Other movement helpers
// ---------------------------------------------------------------------------

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
