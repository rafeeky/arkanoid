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

// --- Sub-step collision probe (lightweight, for MovementSystem integration) ---

/**
 * Quick probe used by moveBallSubSteps onStep callback.
 *
 * Purpose: **tunnel prevention only** — stops the ball at the sub-step where
 * it would enter a boundary, so the full CollisionResolutionService can apply
 * the reflection correctly on the final state. The velocity is returned
 * unchanged; only the position is "frozen" at this step.
 *
 * When a collision boundary is crossed, returns { vx, vy } identical to the
 * input (no velocity change), which signals moveBallSubSteps to stop advancing
 * further sub-steps. The final position will be on or just inside the boundary
 * so detectCollisions() can pick it up normally.
 *
 * Returns null when no boundary is crossed — sub-stepping continues.
 */
export function probeSubStepCollision(
  cx: number,
  cy: number,
  vx: number,
  vy: number,
  blocks: BlockState[],
  bar: BarState,
  prevVy: number,
): { vx: number; vy: number } | null {
  // Wall probe — stop when ball has crossed a wall boundary
  if (cx - BALL_RADIUS <= 0) return { vx, vy };
  if (cx + BALL_RADIUS >= CANVAS_WIDTH) return { vx, vy };
  if (cy - BALL_RADIUS <= 0) return { vx, vy };

  // Bar probe (only when moving downward)
  if (prevVy > 0) {
    const barRect = rectFromBar(bar);
    if (circleOverlapsRect(cx, cy, BALL_RADIUS, barRect)) {
      return { vx, vy };
    }
  }

  // Block probe — stop when ball enters an active block
  for (const block of blocks) {
    if (block.isDestroyed) continue;
    const rect = rectFromBlock(block);
    if (circleOverlapsRect(cx, cy, BALL_RADIUS, rect)) {
      return { vx, vy };
    }
  }

  return null;
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
