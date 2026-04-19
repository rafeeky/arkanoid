import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';
import type { BarState } from '../state/BarState';
import type { ItemDropState } from '../state/ItemDropState';

// --- Collision fact types ---

export type BallHitWallFact = {
  type: 'BallHitWall';
  ballId: string;
  side: 'left' | 'right' | 'top';
};

export type BallHitBarFact = {
  type: 'BallHitBar';
  ballId: string;
  /** Normalized contact point: -1 = left edge, 0 = center, +1 = right edge */
  barContactX: number;
};

export type BallHitBlockFact = {
  type: 'BallHitBlock';
  ballId: string;
  blockId: string;
  side: 'left' | 'right' | 'top' | 'bottom';
};

export type BallHitFloorFact = {
  type: 'BallHitFloor';
  ballId: string;
};

export type ItemPickedUpFact = {
  type: 'ItemPickedUp';
  itemId: string;
};

export type ItemFellOffFloorFact = {
  type: 'ItemFellOffFloor';
  itemId: string;
};

export type CollisionFact =
  | BallHitWallFact
  | BallHitBarFact
  | BallHitBlockFact
  | BallHitFloorFact
  | ItemPickedUpFact
  | ItemFellOffFloorFact;

// --- Constants ---

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const BALL_RADIUS = 8;
const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const BAR_HEIGHT = 16;

// --- AABB helpers ---

type Rect = { x: number; y: number; width: number; height: number };

function rectFromBlock(block: BlockState): Rect {
  return { x: block.x, y: block.y, width: BLOCK_WIDTH, height: BLOCK_HEIGHT };
}

function rectFromBar(bar: BarState): Rect {
  return { x: bar.x - bar.width / 2, y: bar.y - BAR_HEIGHT / 2, width: bar.width, height: BAR_HEIGHT };
}

function rectFromItem(item: ItemDropState): Rect {
  const ITEM_W = 24;
  const ITEM_H = 12;
  return { x: item.x - ITEM_W / 2, y: item.y - ITEM_H / 2, width: ITEM_W, height: ITEM_H };
}

/**
 * Circle-AABB overlap test.
 * The AABB is defined by its top-left corner (rect.x, rect.y) and size.
 * Returns true when the circle overlaps the rect.
 */
function circleOverlapsRect(cx: number, cy: number, radius: number, rect: Rect): boolean {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * AABB-AABB overlap test.
 */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Determine which side of the rect the ball is hitting based on the
 * previous ball position relative to the block center.
 * This avoids corner-case ambiguity.
 */
function determineSideFromPrevPos(
  prevBallX: number,
  prevBallY: number,
  rect: Rect,
): 'left' | 'right' | 'top' | 'bottom' {
  const rectCx = rect.x + rect.width / 2;
  const rectCy = rect.y + rect.height / 2;
  const dx = prevBallX - rectCx;
  const dy = prevBallY - rectCy;

  // Use the half-dimensions of the rect to normalize the vector
  const nx = dx / (rect.width / 2);
  const ny = dy / (rect.height / 2);

  if (Math.abs(nx) > Math.abs(ny)) {
    return nx > 0 ? 'right' : 'left';
  }
  return ny > 0 ? 'bottom' : 'top';
}

// --- Ball detection helpers ---

function detectBallWallCollisions(ball: BallState): BallHitWallFact[] {
  const facts: BallHitWallFact[] = [];

  if (ball.x - BALL_RADIUS <= 0) {
    facts.push({ type: 'BallHitWall', ballId: ball.id, side: 'left' });
  } else if (ball.x + BALL_RADIUS >= CANVAS_WIDTH) {
    facts.push({ type: 'BallHitWall', ballId: ball.id, side: 'right' });
  }

  if (ball.y - BALL_RADIUS <= 0) {
    facts.push({ type: 'BallHitWall', ballId: ball.id, side: 'top' });
  }

  return facts;
}

function detectBallFloor(ball: BallState): BallHitFloorFact | null {
  if (ball.y - BALL_RADIUS > CANVAS_HEIGHT) {
    return { type: 'BallHitFloor', ballId: ball.id };
  }
  return null;
}

function detectBallBarCollision(
  ball: BallState,
  prevBall: BallState,
  bar: BarState,
): BallHitBarFact | null {
  const barRect = rectFromBar(bar);
  if (!circleOverlapsRect(ball.x, ball.y, BALL_RADIUS, barRect)) {
    return null;
  }
  // Only trigger when ball is moving downward (coming from above)
  if (prevBall.vy <= 0) {
    return null;
  }
  const contactX = (ball.x - bar.x) / (bar.width / 2);
  const clampedContactX = Math.max(-1, Math.min(1, contactX));
  return { type: 'BallHitBar', ballId: ball.id, barContactX: clampedContactX };
}

function detectBallBlockCollisions(
  ball: BallState,
  prevBall: BallState,
  blocks: BlockState[],
): BallHitBlockFact | null {
  type Candidate = { block: BlockState; distSq: number };
  const candidates: Candidate[] = [];

  for (const block of blocks) {
    if (block.isDestroyed) continue;
    const rect = rectFromBlock(block);
    if (!circleOverlapsRect(ball.x, ball.y, BALL_RADIUS, rect)) continue;
    const dx = ball.x - (block.x + BLOCK_WIDTH / 2);
    const dy = ball.y - (block.y + BLOCK_HEIGHT / 2);
    candidates.push({ block, distSq: dx * dx + dy * dy });
  }

  if (candidates.length === 0) return null;

  // Pick closest block to avoid multi-block penetration in one tick
  candidates.sort((a, b) => a.distSq - b.distSq);
  const closestCandidate = candidates[0];
  if (!closestCandidate) return null;
  const closest = closestCandidate.block;
  const side = determineSideFromPrevPos(prevBall.x, prevBall.y, rectFromBlock(closest));

  return { type: 'BallHitBlock', ballId: ball.id, blockId: closest.id, side };
}

// --- Item detection helpers ---

function detectItemPickedUp(item: ItemDropState, bar: BarState): ItemPickedUpFact | null {
  if (item.isCollected) return null;
  const itemRect = rectFromItem(item);
  const barRect = rectFromBar(bar);
  if (rectsOverlap(itemRect, barRect)) {
    return { type: 'ItemPickedUp', itemId: item.id };
  }
  return null;
}

function detectItemFellOff(item: ItemDropState): ItemFellOffFloorFact | null {
  if (item.isCollected) return null;
  if (item.y > CANVAS_HEIGHT) {
    return { type: 'ItemFellOffFloor', itemId: item.id };
  }
  return null;
}

// --- Swept collision (for MovementSystem integration) ---

/**
 * Result of a swept ball-vs-block collision test.
 */
export type SweptBlockHit = {
  /** Normalised hit time in [0, 1] (0 = start of sweep, 1 = end) */
  t: number;
  /** The block that was hit */
  block: BlockState;
  /** Which face was hit */
  side: 'left' | 'right' | 'top' | 'bottom';
  /**
   * When true, the hit was detected because the ball centre was already inside
   * the expanded AABB at the start of this sweep (tEntry <= 0).
   * The caller MUST push the ball to the actual expanded AABB boundary rather
   * than relying on the tiny epsilon nudge from the contact point.
   */
  alreadyInside: boolean;
  /**
   * The expanded AABB boundaries used for this hit.
   * Provided so the caller can compute the exact push-out position.
   */
  expandedBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  /**
   * When the normal components on both axes are nearly equal (corner approach),
   * both axes should be reflected.  This flag is set when
   * |txEntry - tyEntry| < CORNER_THRESHOLD.
   */
  isCorner: boolean;
};

/**
 * Swept circle-vs-AABB collision using Minkowski sum expansion.
 *
 * Expands the block AABB by BALL_RADIUS on every side, then tests whether
 * the ball's centre ray (from x0,y0 in direction vx,vy over dt) intersects
 * the expanded AABB.  Returns the earliest intersection time t ∈ (0, 1] or
 * null if there is no intersection within the sweep.
 *
 * "Expanded AABB" sides:
 *   left   = block.x           - BALL_RADIUS
 *   right  = block.x + width   + BALL_RADIUS
 *   top    = block.y           - BALL_RADIUS
 *   bottom = block.y + height  + BALL_RADIUS
 *
 * We solve four slab entry times and take the largest (entry), compare with
 * the smallest (exit).  If entry < exit and entry ≤ 1 we have a hit.
 */
/**
 * When |txEntry - tyEntry| is smaller than this threshold (in normalised
 * sweep-time units) the ball is considered to be hitting a corner — both
 * velocity components will be reversed by the caller.
 */
const CORNER_THRESHOLD = 0.02;

function sweepBallVsBlock(
  x0: number,
  y0: number,
  vx: number,
  vy: number,
  dt: number,
  block: BlockState,
): SweptBlockHit | null {
  const dx = vx * dt;
  const dy = vy * dt;

  const left   = block.x             - BALL_RADIUS;
  const right  = block.x + BLOCK_WIDTH  + BALL_RADIUS;
  const top    = block.y             - BALL_RADIUS;
  const bottom = block.y + BLOCK_HEIGHT + BALL_RADIUS;

  const expandedBounds = { left, right, top, bottom };

  // Slab method — compute entry/exit times for x and y axes separately
  let txEntry: number;
  let txExit: number;
  if (dx === 0) {
    // No movement in x; already inside if x0 is between slabs
    if (x0 < left || x0 > right) return null;
    txEntry = -Infinity;
    txExit  =  Infinity;
  } else {
    const t1x = (left  - x0) / dx;
    const t2x = (right - x0) / dx;
    txEntry = Math.min(t1x, t2x);
    txExit  = Math.max(t1x, t2x);
  }

  let tyEntry: number;
  let tyExit: number;
  if (dy === 0) {
    if (y0 < top || y0 > bottom) return null;
    tyEntry = -Infinity;
    tyExit  =  Infinity;
  } else {
    const t1y = (top    - y0) / dy;
    const t2y = (bottom - y0) / dy;
    tyEntry = Math.min(t1y, t2y);
    tyExit  = Math.max(t1y, t2y);
  }

  const tEntry = Math.max(txEntry, tyEntry);
  const tExit  = Math.min(txExit,  tyExit);

  // No hit if the slabs don't overlap, or entry is beyond the sweep, or entry
  // is at or before t=0 (already inside — treat as touching, handle below)
  if (tEntry >= tExit) return null;
  if (tEntry > 1) return null;
  if (tExit  <= 0) return null;

  // Use tEntry clamped to [0, 1].  If the ball starts already overlapping
  // (tEntry <= 0), we use t=0 but still determine the side so we can push
  // out immediately.
  const t = Math.max(0, tEntry);
  const alreadyInside = tEntry <= 0;

  // Determine hit side.
  // For the normal case (tEntry > 0): the constraining slab (larger txEntry/tyEntry)
  // determines the hit face.
  // For the already-inside case (tEntry <= 0): use the velocity direction to pick
  // the face the ball is moving TOWARD (shortest exit distance in velocity direction).
  // This fixes the bug where the old code reflected the wrong axis and sent the ball
  // deeper into the block body.
  let side: 'left' | 'right' | 'top' | 'bottom';
  const isCorner = !alreadyInside && Math.abs(txEntry - tyEntry) < CORNER_THRESHOLD;

  if (alreadyInside) {
    // Determine the face the ball entered from by finding the minimum
    // penetration depth in the direction OPPOSITE to the ball's velocity.
    //
    // If vy > 0 (moving down), the ball came from above → entered TOP face.
    //   Entry penetration on y = y0 - top  (how far it has crossed the top boundary)
    // If vy < 0 (moving up), the ball came from below → entered BOTTOM face.
    //   Entry penetration on y = bottom - y0
    // Likewise for x.
    //
    // We pick the axis with the smallest entry penetration — the face through
    // which the ball most recently entered — and push it back out through that face.
    let xPenetration = Infinity;
    let yPenetration = Infinity;
    let xSideEntry: 'left' | 'right' = 'left';
    let ySideEntry: 'top' | 'bottom' = 'top';

    if (dx !== 0) {
      if (vx > 0) {
        // Moving right → entered from LEFT face
        xPenetration = x0 - left;
        xSideEntry = 'left';
      } else {
        // Moving left → entered from RIGHT face
        xPenetration = right - x0;
        xSideEntry = 'right';
      }
    }

    if (dy !== 0) {
      if (vy > 0) {
        // Moving down → entered from TOP face
        yPenetration = y0 - top;
        ySideEntry = 'top';
      } else {
        // Moving up → entered from BOTTOM face
        yPenetration = bottom - y0;
        ySideEntry = 'bottom';
      }
    }

    // Push out through the face with the smallest penetration depth
    // (the face the ball entered most recently / most shallowly).
    side = xPenetration <= yPenetration ? xSideEntry : ySideEntry;
  } else if (txEntry > tyEntry) {
    // x-axis was the constraining slab
    side = dx > 0 ? 'left' : 'right';
  } else {
    // y-axis was the constraining slab
    side = dy > 0 ? 'top' : 'bottom';
  }

  // ---------------------------------------------------------------------------
  // Minkowski rounded-corner correction.
  //
  // The expanded AABB has SHARP corners, but the real Minkowski sum of a circle
  // and an AABB has ROUNDED corners (quarter-circle arcs at the four body corners).
  // The four corner regions of the expanded AABB that lie outside the rounded arcs:
  //
  //   top-left    corner region:  contact x < block.x               AND contact y < block.y
  //   top-right   corner region:  contact x > block.x + BLOCK_WIDTH  AND contact y < block.y
  //   bottom-left  corner region: contact x < block.x               AND contact y > block.y + BLOCK_HEIGHT
  //   bottom-right corner region: contact x > block.x + BLOCK_WIDTH  AND contact y > block.y + BLOCK_HEIGHT
  //
  // In these regions the expanded AABB over-approximates.  We solve the exact
  // circle-vs-corner intersection (quadratic) to find the real t.  If there is
  // no real intersection within [0,1] this hit is a false positive and we
  // return null.
  // ---------------------------------------------------------------------------
  const contactX = x0 + vx * dt * t;
  const contactY = y0 + vy * dt * t;

  const inLeftCornerX  = contactX < block.x;
  const inRightCornerX = contactX > block.x + BLOCK_WIDTH;
  const inTopCornerY    = contactY < block.y;
  const inBottomCornerY = contactY > block.y + BLOCK_HEIGHT;

  if ((inLeftCornerX || inRightCornerX) && (inTopCornerY || inBottomCornerY)) {
    // Ball is in a corner region of the expanded AABB.
    // Find the nearest block body corner and solve for real circle-corner t.
    const cornerBodyX = inLeftCornerX  ? block.x               : block.x + BLOCK_WIDTH;
    const cornerBodyY = inTopCornerY   ? block.y               : block.y + BLOCK_HEIGHT;

    const ex = x0 - cornerBodyX;
    const ey = y0 - cornerBodyY;
    const ddx = vx * dt;
    const ddy = vy * dt;

    // (ex + ddx*t)^2 + (ey + ddy*t)^2 = BALL_RADIUS^2
    const a = ddx * ddx + ddy * ddy;
    const b = 2 * (ex * ddx + ey * ddy);
    const c = ex * ex + ey * ey - BALL_RADIUS * BALL_RADIUS;

    if (a === 0) {
      // No movement — check if already touching the corner
      if (c > 0) return null; // ball centre is more than BALL_RADIUS away
      // Already touching; treat as alreadyInside (t stays at 0)
      return { t, block, side, alreadyInside, expandedBounds, isCorner };
    }

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
      // Ball trajectory misses the body corner entirely — false positive
      return null;
    }

    const sqrtDisc = Math.sqrt(discriminant);
    const tCorner1 = (-b - sqrtDisc) / (2 * a);
    const tCorner2 = (-b + sqrtDisc) / (2 * a);

    // Choose the smallest t in [0, 1]
    let tCorner: number | null = null;
    for (const tc of [tCorner1, tCorner2]) {
      if (tc >= -1e-9 && tc <= 1 + 1e-9) {
        const tcClamped = Math.max(0, tc);
        if (tCorner === null || tcClamped < tCorner) {
          tCorner = tcClamped;
        }
      }
    }

    if (tCorner === null) {
      // Intersection is outside [0,1] — no hit this sweep step
      return null;
    }

    // Compute the real contact position at tCorner.
    const realContactX = x0 + vx * dt * tCorner;
    const realContactY = y0 + vy * dt * tCorner;

    // Determine the dominant axis at the contact point.
    // The contact normal points from the block body corner outward toward the ball centre.
    // We choose the axis where the ball centre is furthest from the corner body point —
    // that axis determines which face the ball effectively bounced off.
    //
    // This ensures the push-out direction and velocity reflection are applied on the
    // correct single axis, avoiding the double-axis push that could teleport the ball
    // through the adjacent face.
    const distToCornerX = Math.abs(realContactX - cornerBodyX);
    const distToCornerY = Math.abs(realContactY - cornerBodyY);

    let cornerSide: 'left' | 'right' | 'top' | 'bottom';
    if (distToCornerX >= distToCornerY) {
      // Dominant contact on x-axis
      cornerSide = inRightCornerX ? 'right' : 'left';
    } else {
      // Dominant contact on y-axis
      cornerSide = inBottomCornerY ? 'bottom' : 'top';
    }

    const realAlreadyInside = tCorner <= 0 || alreadyInside;
    const realT = Math.max(0, tCorner);

    return {
      t: realT,
      block,
      side: cornerSide,
      alreadyInside: realAlreadyInside,
      expandedBounds,
      // isCorner=false: use single-axis reflection (dominant face).
      // Double-axis push would teleport the ball through the adjacent face.
      isCorner: false,
    };
  }

  return { t, block, side, alreadyInside, expandedBounds, isCorner };
}

/**
 * Computes the squared distance from a point to a block's body centre.
 * Used for tie-breaking when multiple blocks share the same earliest hit time.
 */
function distSqToCentre(px: number, py: number, block: BlockState): number {
  const cx = block.x + BLOCK_WIDTH  / 2;
  const cy = block.y + BLOCK_HEIGHT / 2;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

/**
 * Tests the ball sweep against all active blocks and returns the earliest hit,
 * or null if none.
 *
 * When multiple blocks share the same earliest t (which happens in the
 * expanded-AABB overlap zone between adjacent blocks), the block whose body
 * centre is closest to the ball start position wins.  This prevents the
 * iteration-order tie-break from selecting an adjacent block that is
 * geometrically farther from the actual impact point.
 */
export function sweepBallVsBlocks(
  x0: number,
  y0: number,
  vx: number,
  vy: number,
  dt: number,
  blocks: BlockState[],
): SweptBlockHit | null {
  let earliest: SweptBlockHit | null = null;
  let earliestDistSq = Infinity;

  for (const block of blocks) {
    if (block.isDestroyed) continue;
    const hit = sweepBallVsBlock(x0, y0, vx, vy, dt, block);
    if (hit === null) continue;

    const dSq = distSqToCentre(x0, y0, block);

    if (earliest === null) {
      earliest = hit;
      earliestDistSq = dSq;
    } else if (hit.t < earliest.t - 1e-9) {
      // Strictly earlier — always prefer
      earliest = hit;
      earliestDistSq = dSq;
    } else if (hit.t <= earliest.t + 1e-9) {
      // Same t (within floating-point tolerance) — prefer body-closer block
      if (dSq < earliestDistSq) {
        earliest = hit;
        earliestDistSq = dSq;
      }
    }
  }

  return earliest;
}

// --- Main export ---

export function detectCollisions(
  state: GameplayRuntimeState,
  prevState: GameplayRuntimeState,
): CollisionFact[] {
  const facts: CollisionFact[] = [];

  for (let i = 0; i < state.balls.length; i++) {
    const ball = state.balls[i];
    if (!ball) continue;
    const prevBall = prevState.balls[i] ?? ball;
    if (!prevBall) continue;

    if (!ball.isActive) continue;

    // Wall collisions
    for (const f of detectBallWallCollisions(ball)) {
      facts.push(f);
    }

    // Floor
    const floorFact = detectBallFloor(ball);
    if (floorFact) {
      facts.push(floorFact);
      continue; // Ball fell off — no further checks for this ball this tick
    }

    // Bar collision
    const barFact = detectBallBarCollision(ball, prevBall, state.bar);
    if (barFact) {
      facts.push(barFact);
    }

    // Block collision — at most 1 per ball per tick
    const blockFact = detectBallBlockCollisions(ball, prevBall, state.blocks);
    if (blockFact) {
      facts.push(blockFact);
    }
  }

  // Item drop interactions
  for (const item of state.itemDrops) {
    const pickFact = detectItemPickedUp(item, state.bar);
    if (pickFact) {
      facts.push(pickFact);
      continue;
    }
    const fallFact = detectItemFellOff(item);
    if (fallFact) {
      facts.push(fallFact);
    }
  }

  return facts;
}
