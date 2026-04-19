import type { BarState } from '../state/BarState';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';
import type { ItemDropState } from '../state/ItemDropState';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { BallHitBlockFact, BallHitWallFact } from './CollisionService';
import { sweepBallVsBlocks } from './CollisionService';
import { enforceMinAngle } from './CollisionResolutionService';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
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
 *
 * Raised from 4 to 8: dense block grids and high-speed balls can require more
 * than 4 bounces per tick.  At 8 the cap is only hit in truly extreme scenarios
 * (e.g. speed > 5000 px/s with gap=0 blocks), and even then the free-advance
 * guard below prevents tunnelling.
 */
const MAX_BOUNCE_COUNT = 8;

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
  /** BallHitWall facts accumulated during this tick (walls handled inside swept loop) */
  wallFacts: BallHitWallFact[];
};

/**
 * Moves the ball for the given dt using swept AABB collision against blocks
 * AND playfield walls (left, right, top).
 *
 * Algorithm (per-tick):
 *   1. Compute earliest swept hit among active blocks AND walls for remaining dt.
 *   2. If hit within remaining dt:
 *      a. Advance ball to the hit position.
 *      b. Reflect the velocity on the hit axis (both axes for corner hits).
 *      c. Push ball strictly outside the boundary (expanded AABB boundary for
 *         blocks, wall boundary for walls).
 *      d. Accumulate a fact.
 *      e. Subtract elapsed time from remaining dt and repeat (up to MAX_BOUNCE_COUNT).
 *   3. If no hit, advance ball by the remaining dt and stop.
 *
 * Walls are handled here (instead of the post-tick detectCollisions pipeline)
 * to prevent the ball from escaping the playfield during a single tick when a
 * block and a wall are hit in the same frame.
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
    return { ball, blockFacts: [], wallFacts: [] };
  }

  const blockFacts: BallHitBlockFact[] = [];
  const wallFacts: BallHitWallFact[] = [];
  // Track which blocks have already been reflected this tick to prevent the
  // same block from flipping the velocity more than once (sign-flip bug).
  const hitBlockIds = new Set<string>();
  // Track which walls have been hit this tick to prevent duplicate reflections.
  const hitWalls = new Set<'left' | 'right' | 'top'>();
  let current = ball;
  let remaining = dt;

  for (let bounce = 0; bounce < MAX_BOUNCE_COUNT; bounce++) {
    if (remaining <= 0) break;

    // --- Compute earliest wall hit ---
    const wallHit = sweepBallVsWalls(current.x, current.y, current.vx, current.vy, remaining);

    // --- Compute earliest block hit ---
    const blockHit = sweepBallVsBlocks(
      current.x,
      current.y,
      current.vx,
      current.vy,
      remaining,
      blocks,
    );

    // Determine which comes first (wall or block)
    const wallFirst =
      wallHit !== null &&
      (blockHit === null || wallHit.t <= blockHit.t) &&
      !hitWalls.has(wallHit.side);

    const blockFirst =
      blockHit !== null &&
      !hitBlockIds.has(blockHit.block.id) &&
      (wallHit === null || blockHit.t < wallHit.t || hitWalls.has(wallHit.side));

    if (!wallFirst && !blockFirst) {
      // No more collisions — advance freely for remaining time
      current = {
        ...current,
        x: current.x + current.vx * remaining,
        y: current.y + current.vy * remaining,
      };
      remaining = 0;
      break;
    }

    if (wallFirst && wallHit !== null) {
      // --- Wall collision ---
      const elapsed = wallHit.t * remaining;
      let contactX = current.x + current.vx * elapsed;
      let contactY = current.y + current.vy * elapsed;

      let newVx = current.vx;
      let newVy = current.vy;

      // Reflect and clamp to boundary
      if (wallHit.side === 'left') {
        newVx = Math.abs(newVx); // ensure positive (moving right)
        contactX = BALL_RADIUS + BLOCK_PUSH_OUT_EPSILON;
      } else if (wallHit.side === 'right') {
        newVx = -Math.abs(newVx); // ensure negative (moving left)
        contactX = CANVAS_WIDTH - BALL_RADIUS - BLOCK_PUSH_OUT_EPSILON;
      } else {
        // top
        newVy = Math.abs(newVy); // ensure positive (moving down)
        contactY = BALL_RADIUS + BLOCK_PUSH_OUT_EPSILON;
      }

      const enforced = enforceMinAngle(newVx, newVy);
      newVx = enforced.vx;
      newVy = enforced.vy;

      wallFacts.push({ type: 'BallHitWall', ballId: ball.id, side: wallHit.side });
      hitWalls.add(wallHit.side);
      remaining -= elapsed;
      current = { ...current, x: contactX, y: contactY, vx: newVx, vy: newVy };

    } else if (blockHit !== null) {
      // --- Block collision ---
      const elapsed = blockHit.t * remaining;
      const contactX = current.x + current.vx * elapsed;
      const contactY = current.y + current.vy * elapsed;

      // Reflect velocity.
      // Corner hits (isCorner=true) reflect both axes to prevent the ball
      // from sliding along the corner and tunnelling into the block.
      let newVx = current.vx;
      let newVy = current.vy;
      if (blockHit.isCorner) {
        // Both axes reversed for corner impact
        newVx = -newVx;
        newVy = -newVy;
      } else if (blockHit.side === 'left' || blockHit.side === 'right') {
        newVx = -newVx;
      } else {
        newVy = -newVy;
      }
      const enforced = enforceMinAngle(newVx, newVy);
      newVx = enforced.vx;
      newVy = enforced.vy;

      // Position correction.
      // For normal hits (t > 0): contactX/Y is on the expanded AABB boundary,
      // so a small epsilon nudge is enough.
      // For already-inside hits (t = 0): contactX/Y equals the starting position
      // which is already inside the boundary — we MUST push to the actual
      // expanded AABB face.
      let pushX = contactX;
      let pushY = contactY;
      const bounds = blockHit.expandedBounds;

      if (blockHit.alreadyInside) {
        // Push to the actual expanded AABB boundary + epsilon
        switch (blockHit.side) {
          case 'top':    pushY = bounds.top    - BLOCK_PUSH_OUT_EPSILON; break;
          case 'bottom': pushY = bounds.bottom + BLOCK_PUSH_OUT_EPSILON; break;
          case 'left':   pushX = bounds.left   - BLOCK_PUSH_OUT_EPSILON; break;
          case 'right':  pushX = bounds.right  + BLOCK_PUSH_OUT_EPSILON; break;
        }
      } else {
        // contactX/Y is already on the boundary; just nudge by epsilon
        switch (blockHit.side) {
          case 'top':    pushY = contactY - BLOCK_PUSH_OUT_EPSILON; break;
          case 'bottom': pushY = contactY + BLOCK_PUSH_OUT_EPSILON; break;
          case 'left':   pushX = contactX - BLOCK_PUSH_OUT_EPSILON; break;
          case 'right':  pushX = contactX + BLOCK_PUSH_OUT_EPSILON; break;
        }
      }

      // For corner hits, push out on both axes
      if (blockHit.isCorner) {
        // Apply push in the direction the ball came from on each axis
        if (current.vx > 0) {
          pushX = bounds.right + BLOCK_PUSH_OUT_EPSILON;
        } else if (current.vx < 0) {
          pushX = bounds.left - BLOCK_PUSH_OUT_EPSILON;
        }
        if (current.vy > 0) {
          pushY = bounds.bottom + BLOCK_PUSH_OUT_EPSILON;
        } else if (current.vy < 0) {
          pushY = bounds.top - BLOCK_PUSH_OUT_EPSILON;
        }
      }

      blockFacts.push({
        type: 'BallHitBlock',
        ballId: ball.id,
        blockId: blockHit.block.id,
        side: blockHit.side,
      });

      hitBlockIds.add(blockHit.block.id);

      if (blockHit.alreadyInside) {
        // The ball was already inside the expanded AABB at the start of this
        // sweep (missed by previous tick).  The push-out corrects the position;
        // consuming the remaining time prevents the free-advance from moving
        // the ball back inside the expanded AABB and producing a re-hit next tick.
        remaining = 0;
      } else {
        remaining -= elapsed;
      }

      current = { ...current, x: pushX, y: pushY, vx: newVx, vy: newVy };
    }
  }

  // If we hit the bounce cap (or exited the loop with remaining > 0 because
  // all hits were skipped via hitBlockIds/hitWalls), guard against tunnelling:
  //
  // Before free-advancing, run one final sweep that ignores hitBlockIds and
  // hitWalls filters.  If there is still a block in the ball's path we clamp
  // the ball just outside that block's expanded AABB boundary and stop.
  // No velocity reflection is applied here — the block will be hit again next
  // tick and the normal swept loop will handle it.  This prevents the ball from
  // silently passing through a block that was "seen" by the sweep but skipped
  // because it was already in hitBlockIds.
  if (remaining > 0) {
    const guardHit = sweepBallVsBlocks(
      current.x,
      current.y,
      current.vx,
      current.vy,
      remaining,
      blocks,
    );

    if (guardHit !== null) {
      // A block is in the path.  Advance only to the block boundary (do not
      // pass through it).  No reflection — leave velocity unchanged so the
      // next tick can resolve the collision normally.
      const elapsed = guardHit.t * remaining;
      let clampX = current.x + current.vx * elapsed;
      let clampY = current.y + current.vy * elapsed;

      // Push the ball strictly outside the expanded AABB boundary so the next
      // tick's sweep does not see it as alreadyInside.
      const gb = guardHit.expandedBounds;
      if (!guardHit.alreadyInside) {
        switch (guardHit.side) {
          case 'top':    clampY = gb.top    - BLOCK_PUSH_OUT_EPSILON; break;
          case 'bottom': clampY = gb.bottom + BLOCK_PUSH_OUT_EPSILON; break;
          case 'left':   clampX = gb.left   - BLOCK_PUSH_OUT_EPSILON; break;
          case 'right':  clampX = gb.right  + BLOCK_PUSH_OUT_EPSILON; break;
        }
      } else {
        // Already inside: push to actual boundary face
        switch (guardHit.side) {
          case 'top':    clampY = gb.top    - BLOCK_PUSH_OUT_EPSILON; break;
          case 'bottom': clampY = gb.bottom + BLOCK_PUSH_OUT_EPSILON; break;
          case 'left':   clampX = gb.left   - BLOCK_PUSH_OUT_EPSILON; break;
          case 'right':  clampX = gb.right  + BLOCK_PUSH_OUT_EPSILON; break;
        }
      }

      current = { ...current, x: clampX, y: clampY };
    } else {
      // No block in path — free-advance is safe.
      current = {
        ...current,
        x: current.x + current.vx * remaining,
        y: current.y + current.vy * remaining,
      };
    }
  }

  // Final wall clamp — safety net ensuring the ball cannot escape the playfield
  // regardless of floating-point accumulation.
  current = clampBallToPlayfield(current);

  return { ball: current, blockFacts, wallFacts };
}

// ---------------------------------------------------------------------------
// Wall swept collision helpers
// ---------------------------------------------------------------------------

type WallHit = {
  t: number;
  side: 'left' | 'right' | 'top';
};

/**
 * Computes the earliest wall collision time for the ball sweep.
 * Only left, right, and top walls are bouncing surfaces.
 * The bottom (floor) is a loss condition, not a wall.
 */
function sweepBallVsWalls(
  x0: number,
  y0: number,
  vx: number,
  vy: number,
  dt: number,
): WallHit | null {
  let earliest: WallHit | null = null;

  function checkWall(t: number, side: 'left' | 'right' | 'top'): void {
    if (t > 0 && t <= 1 && (earliest === null || t < (earliest as WallHit).t)) {
      earliest = { t, side };
    }
  }

  // Left wall: ball centre must reach x = BALL_RADIUS
  if (vx < 0) {
    checkWall((BALL_RADIUS - x0) / (vx * dt), 'left');
  }

  // Right wall: ball centre must reach x = CANVAS_WIDTH - BALL_RADIUS
  if (vx > 0) {
    checkWall((CANVAS_WIDTH - BALL_RADIUS - x0) / (vx * dt), 'right');
  }

  // Top wall: ball centre must reach y = BALL_RADIUS
  if (vy < 0) {
    checkWall((BALL_RADIUS - y0) / (vy * dt), 'top');
  }

  return earliest;
}

/**
 * Clamps the ball position to playfield bounds [BALL_RADIUS, CANVAS_WIDTH-BALL_RADIUS]
 * on x-axis and [BALL_RADIUS, CANVAS_HEIGHT] on y-axis (floor is open).
 * Also ensures velocity points inward if ball is at a boundary.
 */
function clampBallToPlayfield(ball: BallState): BallState {
  let { x, y, vx, vy } = ball;

  if (x - BALL_RADIUS < 0) {
    x = BALL_RADIUS + BLOCK_PUSH_OUT_EPSILON;
    if (vx < 0) vx = -vx;
  } else if (x + BALL_RADIUS > CANVAS_WIDTH) {
    x = CANVAS_WIDTH - BALL_RADIUS - BLOCK_PUSH_OUT_EPSILON;
    if (vx > 0) vx = -vx;
  }

  if (y - BALL_RADIUS < 0) {
    y = BALL_RADIUS + BLOCK_PUSH_OUT_EPSILON;
    if (vy < 0) vy = -vy;
  }

  if (x === ball.x && y === ball.y && vx === ball.vx && vy === ball.vy) {
    return ball; // no change
  }
  return { ...ball, x, y, vx, vy };
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
/**
 * Epsilon used for the sanity-check "ball centre inside block" boundary test.
 *
 * Using strict inequality (< and >) to detect overlap causes a miss when the
 * ball centre lands *exactly* on a block edge (a common floating-point outcome
 * after push-out with an epsilon nudge).  Adding a small tolerance here ensures
 * that centre-on-edge is treated as "inside" and the push-out fires.
 *
 * Value must be smaller than BLOCK_PUSH_OUT_EPSILON so that a correctly
 * pushed-out ball (offset by BLOCK_PUSH_OUT_EPSILON from the face) is NOT
 * re-triggered on the same frame.
 */
const SANITY_CHECK_EPSILON = 0.1;

function computeBallCenterBlockOverlap(
  ball: BallState,
  block: BlockState,
): { overlapX: number; overlapY: number; cx: number; cy: number } | null {
  const bx = block.x;
  const by = block.y;
  const bRight = bx + BLOCK_WIDTH;
  const bBottom = by + BLOCK_HEIGHT;

  // Use epsilon-inclusive bounds so a ball centre sitting exactly on a block
  // edge (common after push-out with BLOCK_PUSH_OUT_EPSILON nudge) is still
  // classified as "inside" and the defensive push fires.
  if (ball.x < bx - SANITY_CHECK_EPSILON || ball.x > bRight  + SANITY_CHECK_EPSILON) return null;
  if (ball.y < by - SANITY_CHECK_EPSILON || ball.y > bBottom + SANITY_CHECK_EPSILON) return null;

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
        // Only reflect if velocity is pointing INTO the block (toward positive x).
        // If the ball is already moving away (vx < 0), keep the velocity as-is.
        if (newVx > 0) {
          newVx = -newVx;
        }
      } else {
        // Push right
        newX = block.x + BLOCK_WIDTH + BALL_RADIUS + BLOCK_PUSH_OUT_EPSILON;
        side = 'right';
        // Only reflect if velocity is pointing INTO the block (toward negative x).
        if (newVx < 0) {
          newVx = -newVx;
        }
      }
    } else {
      // Push out along y-axis
      if (ball.y < cy) {
        // Ball centre is above block centre → push upward
        newY = block.y - BALL_RADIUS - BLOCK_PUSH_OUT_EPSILON;
        side = 'top';
        // Only reflect if velocity is pointing INTO the block (toward positive y).
        if (newVy > 0) {
          newVy = -newVy;
        }
      } else {
        // Push downward
        newY = block.y + BLOCK_HEIGHT + BALL_RADIUS + BLOCK_PUSH_OUT_EPSILON;
        side = 'bottom';
        // Only reflect if velocity is pointing INTO the block (toward negative y).
        if (newVy < 0) {
          newVy = -newVy;
        }
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

    // Dev-mode diagnostic: log sanity-check corrections so players can share
    // console output when a tunnel-through bug is reported.
    // process.env.NODE_ENV is set to 'production' by bundlers for prod builds.
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
