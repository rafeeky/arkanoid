import type { BarState } from '../state/BarState';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';
import type { BorderBlockState } from '../state/BorderBlockState';
import type { DoorState } from '../state/DoorState';
import type { ItemDropState } from '../state/ItemDropState';
import type { GameplayConfig, PhysicsConfig } from '../../definitions/types/GameplayConfig';
import type { BallHitBlockFact, BallHitWallFact } from './CollisionService';
import { enforceMinAngle } from './CollisionResolutionService';
import * as Block from '../entities/Block';
import * as BorderBlock from '../entities/BorderBlock';
import * as Door from '../entities/Door';
import * as Wall from '../entities/Wall';
import {
  PLAYFIELD_WIDTH as CANVAS_WIDTH,
  PLAYFIELD_HEIGHT as CANVAS_HEIGHT,
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  BAR_HEIGHT,
  BALL_RADIUS,
  INITIAL_LAUNCH_OFFSET_X,
} from './playfieldLayout';

// 외부 호환을 위한 re-export — StageRuntimeFactory 등이 MovementSystem 에서 import 함.
export { INITIAL_LAUNCH_OFFSET_X };

// Physics tuning values (subStepSize, maxSubSteps, pushOutEpsilon, minAngleDeg, barContactBias)
// come from `config.physics` (GameplayConfigTable). Caller threads them in via PhysicsConfig.

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
 * Computes the swept entry time of the ball into the block's expanded AABB
 * along the prev→curr segment.  Returns the MAX of txEntry and tyEntry,
 * matching the "last-axis-to-cross" semantics of slab-based swept collision.
 *
 * Larger value = ball entered this block's AABB more recently.
 * Used as a tie-breaker when multiple blocks overlap simultaneously:
 * the block the ball JUST entered is the one we should reflect off of.
 */
function computeEntryTime(
  prevX: number,
  prevY: number,
  currX: number,
  currY: number,
  block: BlockState,
): number {
  const dx = currX - prevX;
  const dy = currY - prevY;
  const exLeft   = block.x - BALL_RADIUS;
  const exRight  = block.x + BLOCK_WIDTH  + BALL_RADIUS;
  const exTop    = block.y - BALL_RADIUS;
  const exBottom = block.y + BLOCK_HEIGHT + BALL_RADIUS;

  let tx = -Infinity;
  if (dx > 0)       tx = (exLeft   - prevX) / dx;
  else if (dx < 0)  tx = (exRight  - prevX) / dx;

  let ty = -Infinity;
  if (dy > 0)       ty = (exTop    - prevY) / dy;
  else if (dy < 0)  ty = (exBottom - prevY) / dy;

  return Math.max(tx, ty);
}

/**
 * Returns the BEST overlapping non-destroyed block for the ball, or null.
 *
 * "Best" = the block with the latest entry time along the prev→curr segment.
 * Rationale: at 4px inter-block gaps the ball (radius 8) often overlaps two
 * or more adjacent blocks simultaneously.  Neither array order nor
 * centre-distance correctly identifies the block the ball is actually
 * hitting — both fail in symmetric cases (e.g. ball exactly between two
 * vertically-stacked rows).  Entry time is the only metric that captures
 * the *direction of motion*: the block whose boundary the ball just
 * crossed has the largest entry t, regardless of geometric symmetry.
 *
 * This resolves both the 'wrong adjacent block destroyed' report and the
 * cascading tunneling symptoms caused by wrong-block reflection.
 */
function findOverlappingBlock(
  prevX: number,
  prevY: number,
  currX: number,
  currY: number,
  blocks: readonly BlockState[],
  skipIds: ReadonlySet<string>,
): BlockState | null {
  let best: BlockState | null = null;
  let bestEntryT = -Infinity;
  for (const block of blocks) {
    if (block.isDestroyed) continue;
    if (skipIds.has(block.id)) continue;
    if (!circleOverlapsBlock(currX, currY, block)) continue;

    const t = computeEntryTime(prevX, prevY, currX, currY, block);
    if (t > bestEntryT) {
      bestEntryT = t;
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
  borders: readonly BorderBlockState[],
  doors: readonly DoorState[],
  physics: PhysicsConfig,
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
  const steps = Math.max(
    1,
    Math.min(physics.maxSubSteps, Math.ceil(totalDist / physics.subStepSize)),
  );
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

    // b. Wall collisions — Wall.reflectFromBall 이 push-out + 반사를 모두 처리.
    let wallSide: 'left' | 'right' | 'top' | null = null;
    if (current.x - BALL_RADIUS < 0) {
      wallSide = 'left';
    } else if (current.x + BALL_RADIUS > CANVAS_WIDTH) {
      wallSide = 'right';
    } else if (current.y - BALL_RADIUS < 0) {
      wallSide = 'top';
    }
    const wallHit = wallSide !== null;
    if (wallSide !== null) {
      current = Wall.reflectFromBall(
        current,
        { type: 'BallHitWall', ballId: ball.id, side: wallSide },
        physics,
      );
      wallFacts.push({ type: 'BallHitWall', ballId: ball.id, side: wallSide });
    }

    // c. Block collision — process at most one block per sub-step.
    // hitThisSubstep prevents the same block from triggering twice within
    // the same substep (e.g. after push-out lands the ball back in overlap).
    const hitThisSubstep = new Set<string>();
    const hitBlock = findOverlappingBlock(prev.x, prev.y, current.x, current.y, blocks, hitThisSubstep);
    if (hitBlock !== null) {
      hitThisSubstep.add(hitBlock.id);

      const side = determineEntrySide(prev.x, prev.y, current.x, current.y, hitBlock);

      // Block 이 자기 충돌 응답을 소유 — push-out + 반사 + enforceMinAngle.
      current = Block.handleBallCollision(current, side, hitBlock, physics);

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
    } else if (!wallHit) {
      // d. Border / Door collision — block/wall 모두 잡지 못한 substep 에 한해.
      // wall 이 먼저 발동한 경우 같은 substep 에서 border 가 또 반사하면 vx 이중 반전.
      // Border 와 Door 둘 다 깨지지 않으므로 fact 발행 없음.
      // Door 의 closed/opening phase 는 BorderBlock 처럼 차단. opened 도 공은 차단 (스피너만 통과).
      let doorHandled = false;
      if (doors.length > 0) {
        const hitDoor = findOverlappingDoor(current.x, current.y, doors);
        if (hitDoor !== null) {
          const side = determineDoorEntrySide(prev.x, prev.y, current.x, current.y, hitDoor);
          current = Door.handleBallCollision(current, side, hitDoor, physics);
          doorHandled = true;
        }
      }
      if (!doorHandled && borders.length > 0) {
        const hitBorder = findOverlappingBorder(current.x, current.y, borders);
        if (hitBorder !== null) {
          const side = determineBorderEntrySide(prev.x, prev.y, current.x, current.y, hitBorder);
          current = BorderBlock.handleBallCollision(current, side, hitBorder, physics);
        }
      }
    }
  }

  return { ball: current, blockFacts, wallFacts };
}

// ---------------------------------------------------------------------------
// Border collision helpers (orientation-aware bounds)
// ---------------------------------------------------------------------------

function findOverlappingDoor(
  cx: number,
  cy: number,
  doors: readonly DoorState[],
): DoorState | null {
  for (const d of doors) {
    if (!Door.blocksBall(d)) continue;
    const bounds = Door.bounds(d);
    const nearestX = Math.max(bounds.x, Math.min(cx, bounds.x + bounds.width));
    const nearestY = Math.max(bounds.y, Math.min(cy, bounds.y + bounds.height));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    if (dx * dx + dy * dy <= BALL_RADIUS * BALL_RADIUS) {
      return d;
    }
  }
  return null;
}

function determineDoorEntrySide(
  prevX: number,
  prevY: number,
  currX: number,
  currY: number,
  door: DoorState,
): 'top' | 'bottom' | 'left' | 'right' {
  const bounds = Door.bounds(door);
  const dx = currX - prevX;
  const dy = currY - prevY;
  const exLeft   = bounds.x - BALL_RADIUS;
  const exRight  = bounds.x + bounds.width  + BALL_RADIUS;
  const exTop    = bounds.y - BALL_RADIUS;
  const exBottom = bounds.y + bounds.height + BALL_RADIUS;
  let txEntry = -Infinity;
  let xSide: 'left' | 'right' = 'left';
  if (dx > 0) { txEntry = (exLeft  - prevX) / dx; xSide = 'left'; }
  else if (dx < 0) { txEntry = (exRight - prevX) / dx; xSide = 'right'; }
  let tyEntry = -Infinity;
  let ySide: 'top' | 'bottom' = 'top';
  if (dy > 0) { tyEntry = (exTop    - prevY) / dy; ySide = 'top'; }
  else if (dy < 0) { tyEntry = (exBottom - prevY) / dy; ySide = 'bottom'; }
  if (txEntry > tyEntry) return xSide;
  return ySide;
}

function findOverlappingBorder(
  cx: number,
  cy: number,
  borders: readonly BorderBlockState[],
): BorderBlockState | null {
  for (const b of borders) {
    const bounds = BorderBlock.bounds(b);
    const nearestX = Math.max(bounds.x, Math.min(cx, bounds.x + bounds.width));
    const nearestY = Math.max(bounds.y, Math.min(cy, bounds.y + bounds.height));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    if (dx * dx + dy * dy <= BALL_RADIUS * BALL_RADIUS) {
      return b;
    }
  }
  return null;
}

function determineBorderEntrySide(
  prevX: number,
  prevY: number,
  currX: number,
  currY: number,
  border: BorderBlockState,
): 'top' | 'bottom' | 'left' | 'right' {
  const bounds = BorderBlock.bounds(border);
  const dx = currX - prevX;
  const dy = currY - prevY;

  const exLeft   = bounds.x - BALL_RADIUS;
  const exRight  = bounds.x + bounds.width  + BALL_RADIUS;
  const exTop    = bounds.y - BALL_RADIUS;
  const exBottom = bounds.y + bounds.height + BALL_RADIUS;

  let txEntry = -Infinity;
  let xSide: 'left' | 'right' = 'left';
  if (dx > 0) {
    txEntry = (exLeft  - prevX) / dx;
    xSide = 'left';
  } else if (dx < 0) {
    txEntry = (exRight - prevX) / dx;
    xSide = 'right';
  }

  let tyEntry = -Infinity;
  let ySide: 'top' | 'bottom' = 'top';
  if (dy > 0) {
    tyEntry = (exTop    - prevY) / dy;
    ySide = 'top';
  } else if (dy < 0) {
    tyEntry = (exBottom - prevY) / dy;
    ySide = 'bottom';
  }

  if (txEntry > tyEntry) {
    return xSide;
  }
  return ySide;
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
  physics: PhysicsConfig,
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
        newX = bx - BALL_RADIUS - physics.pushOutEpsilon;
        side = 'left';
        if (newVx > 0) newVx = -newVx;
      } else {
        newX = bRight + BALL_RADIUS + physics.pushOutEpsilon;
        side = 'right';
        if (newVx < 0) newVx = -newVx;
      }
    } else {
      // Push out along y-axis
      if (ball.y < cy) {
        newY = by - BALL_RADIUS - physics.pushOutEpsilon;
        side = 'top';
        if (newVy > 0) newVy = -newVy;
      } else {
        newY = bBottom + BALL_RADIUS + physics.pushOutEpsilon;
        side = 'bottom';
        if (newVy < 0) newVy = -newVy;
      }
    }

    const enforced = enforceMinAngle(newVx, newVy, physics.minAngleDeg);
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

/**
 * 비활성 공(자석 부착 포함)을 바에 동기화한다.
 *
 * - attachedOffsetX が定義されている場合: 바 중심 + 오프셋으로 x를 갱신 (자석 부착)
 * - 그 외 비활성 공: 바 중심에서 INITIAL_LAUNCH_OFFSET_X 만큼 우측 고정
 *   (발사 각도 -60° 와 시각적으로 일치 — 우측 발사면 우측에서 출발해야 자연스러움)
 */
// INITIAL_LAUNCH_OFFSET_X 는 playfieldLayout 단일 소스에서 import (위쪽 import).
export function moveAttachedBallToBar(ball: BallState, bar: BarState): BallState {
  if (ball.isActive) {
    return ball;
  }
  if (ball.attachedOffsetX !== undefined) {
    // 자석 부착 공: 바 중심 + 저장된 오프셋으로 x를 동기화
    const attachY = bar.y - BAR_HEIGHT / 2 - BALL_RADIUS;
    return {
      ...ball,
      x: bar.x + ball.attachedOffsetX,
      y: attachY,
    };
  }
  // 일반 비활성 공 (발사 대기) — 우측 30px 오프셋
  return {
    ...ball,
    x: bar.x + INITIAL_LAUNCH_OFFSET_X,
    y: bar.y - BAR_HEIGHT,
  };
}
