import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';
import type { BarState } from '../state/BarState';
import type { ItemDropState } from '../state/ItemDropState';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { ItemDefinition } from '../../definitions/types/ItemDefinition';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type {
  CollisionFact,
  BallHitWallFact,
  BallHitBarFact,
  BallHitBlockFact,
  BallHitFloorFact,
  ItemPickedUpFact,
  ItemFellOffFloorFact,
} from './CollisionService';
import type { GameplayEvent } from '../events/gameplayEvents';
import { BarEffectService } from './BarEffectService';

type ApplyResult = {
  nextState: GameplayRuntimeState;
  events: GameplayEvent[];
};

type Tables = {
  blockDefinitions: Record<string, BlockDefinition>;
  itemDefinitions: Record<string, ItemDefinition>;
  config: GameplayConfig;
};

type ApplyOptions = {
  /**
   * When true, ball velocity reflection for BallHitBlock facts is skipped.
   * Use this when moveBallWithCollisions has already reflected the velocity
   * during the swept movement phase.
   *
   * Default: false (legacy behaviour — resolveBlock reflects the ball).
   */
  blockReflectionAlreadyApplied?: boolean;
};

// --- Playfield geometry constants (mirror of CollisionService to avoid cross-import) ---

const CANVAS_WIDTH = 720;
const BALL_RADIUS = 8;
const BAR_HEIGHT = 16;

/**
 * Epsilon used when snapping ball position to the playfield boundary after a
 * wall reflection.  Matches the push-out value used in MovementSystem for block
 * reflections so both behaviours are symmetric.
 */
const WALL_PUSH_OUT_EPSILON = 0.5;

// --- Minimum angle enforcement ---

const MIN_ANGLE_FROM_AXIS_DEG = 15;
const MIN_SIN = Math.sin((MIN_ANGLE_FROM_AXIS_DEG * Math.PI) / 180); // ≈ 0.259

/**
 * Ensures the velocity vector is never closer than MIN_ANGLE_FROM_AXIS_DEG
 * to either axis (horizontal or vertical).
 *
 * - If |vx|/speed < sin(15°), vx is clamped to ±(speed * sin(15°)) and vy is
 *   recalculated to preserve the speed magnitude and the sign of vy.
 * - Likewise, if |vy|/speed < sin(15°), vy is clamped and vx is recalculated.
 * - Speed magnitude is always preserved.
 * - Normal angles (>15° from both axes) are not modified.
 *
 * Exported so that MovementSystem can apply the same angle constraints after
 * swept block reflections.
 */
export function enforceMinAngle(vx: number, vy: number): { vx: number; vy: number } {
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed === 0) return { vx, vy };

  const minComponent = speed * MIN_SIN;
  let newVx = vx;
  let newVy = vy;

  // Guard against near-vertical trajectory (|vx| too small)
  if (Math.abs(newVx) < minComponent) {
    newVx = minComponent * (newVx >= 0 ? 1 : -1);
    const vySign = newVy >= 0 ? 1 : -1;
    newVy = vySign * Math.sqrt(Math.max(0, speed * speed - newVx * newVx));
  }

  // Guard against near-horizontal trajectory (|vy| too small)
  if (Math.abs(newVy) < minComponent) {
    newVy = minComponent * (newVy >= 0 ? 1 : -1);
    const vxSign = newVx >= 0 ? 1 : -1;
    newVx = vxSign * Math.sqrt(Math.max(0, speed * speed - newVy * newVy));
  }

  return { vx: newVx, vy: newVy };
}

// --- Reflection helpers ---

function reflectBallWall(ball: BallState, fact: BallHitWallFact): BallState {
  let vx = ball.vx;
  let vy = ball.vy;

  // Snap position to just inside the playfield boundary.
  // High-speed balls can overshoot the wall in a single tick, leaving
  // ball.x/y outside the boundary.  Without a snap the ball stays in an
  // out-of-bounds position on the next tick and can skip block sweep checks.
  // The epsilon matches the push-out used for block reflections (symmetric).
  let x = ball.x;
  let y = ball.y;

  if (fact.side === 'left') {
    vx = -vx;
    x = BALL_RADIUS + WALL_PUSH_OUT_EPSILON;
  } else if (fact.side === 'right') {
    vx = -vx;
    x = CANVAS_WIDTH - BALL_RADIUS - WALL_PUSH_OUT_EPSILON;
  } else {
    // top
    vy = -vy;
    y = BALL_RADIUS + WALL_PUSH_OUT_EPSILON;
  }

  const enforced = enforceMinAngle(vx, vy);
  return { ...ball, x, y, vx: enforced.vx, vy: enforced.vy };
}

/**
 * Bar reflection.
 * vy is always forced negative (upward).
 * vx is biased by barContactX: center → small vx, edges → larger vx.
 * Speed magnitude is preserved.
 * enforceMinAngle is applied after to prevent pure vertical trajectories.
 *
 * Formula:
 *   vx = contactX * speed * 0.7
 *   vy = -sqrt(speed^2 - vx^2)   (always upward)
 */
function reflectBallBar(ball: BallState, fact: BallHitBarFact): BallState {
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const rawVx = fact.barContactX * speed * 0.7;
  // Ensure vy has enough magnitude; clamp to avoid pure horizontal trajectory
  const vyMagnitude = Math.sqrt(Math.max(speed * speed - rawVx * rawVx, (speed * 0.3) ** 2));
  const enforced = enforceMinAngle(rawVx, -vyMagnitude);
  // Bar always sends ball upward; preserve upward direction after enforceMinAngle
  return { ...ball, vx: enforced.vx, vy: -Math.abs(enforced.vy) };
}

/**
 * Block reflection based on which side was hit.
 * enforceMinAngle is applied after to prevent pure vertical/horizontal trajectories.
 */
function reflectBallBlock(ball: BallState, fact: BallHitBlockFact): BallState {
  let vx = ball.vx;
  let vy = ball.vy;
  if (fact.side === 'left' || fact.side === 'right') {
    vx = -vx;
  } else {
    vy = -vy;
  }
  const enforced = enforceMinAngle(vx, vy);
  return { ...ball, vx: enforced.vx, vy: enforced.vy };
}

// --- Resolution helpers ---

function resolveWall(
  state: GameplayRuntimeState,
  fact: BallHitWallFact,
): { state: GameplayRuntimeState; events: GameplayEvent[] } {
  const balls = state.balls.map((b) =>
    b.id === fact.ballId ? reflectBallWall(b, fact) : b,
  );
  return { state: { ...state, balls }, events: [] };
}

function attachBallToBar(ball: BallState, bar: BarState, fact: BallHitBarFact): BallState {
  // 바 위 표면 바로 위에 공 중심을 놓는다
  const attachY = bar.y - BAR_HEIGHT / 2 - BALL_RADIUS;
  // 부착 시점의 x 오프셋을 기록한다 (바 중심 기준)
  const offsetX = ball.x - bar.x;
  return {
    ...ball,
    x: ball.x,        // x는 현재 공 위치 그대로 (오프셋으로 보존)
    y: attachY,
    vx: 0,
    vy: 0,
    isActive: false,
    attachedOffsetX: offsetX,
  };
}

function resolveBar(
  state: GameplayRuntimeState,
  fact: BallHitBarFact,
): { state: GameplayRuntimeState; events: GameplayEvent[] } {
  // 자석 상태에서 활성 공이 바에 닿으면 반사 대신 부착
  if (state.bar.activeEffect === 'magnet') {
    const targetBall = state.balls.find((b) => b.id === fact.ballId);
    if (targetBall && targetBall.isActive) {
      const attachedBall = attachBallToBar(targetBall, state.bar, fact);
      const balls = state.balls.map((b) => (b.id === fact.ballId ? attachedBall : b));
      const newAttachedIds = [...state.attachedBallIds, fact.ballId];
      const events: GameplayEvent[] = [
        {
          type: 'BallAttached',
          ballIds: [fact.ballId],
        },
      ];
      return {
        state: { ...state, balls, attachedBallIds: newAttachedIds },
        events,
      };
    }
  }

  // 일반 상태: 반사
  const balls = state.balls.map((b) =>
    b.id === fact.ballId ? reflectBallBar(b, fact) : b,
  );
  return { state: { ...state, balls }, events: [] };
}

function resolveBlock(
  state: GameplayRuntimeState,
  fact: BallHitBlockFact,
  tables: Tables,
  skipBallReflection = false,
): { state: GameplayRuntimeState; events: GameplayEvent[] } {
  const events: GameplayEvent[] = [];

  // Reflect ball (skip when swept movement has already applied the reflection)
  let balls = skipBallReflection
    ? state.balls
    : state.balls.map((b) => (b.id === fact.ballId ? reflectBallBlock(b, fact) : b));

  // Update block
  let blocks: BlockState[] = state.blocks;
  let itemDrops: ItemDropState[] = state.itemDrops;
  let sessionScore = state.session.score;

  const blockIndex = state.blocks.findIndex((b) => b.id === fact.blockId);
  if (blockIndex === -1) {
    return { state: { ...state, balls }, events };
  }

  const block = state.blocks[blockIndex];
  if (!block) {
    return { state: { ...state, balls }, events };
  }
  const newRemainingHits = block.remainingHits - 1;

  if (newRemainingHits <= 0) {
    // Block destroyed
    const def = tables.blockDefinitions[block.definitionId];
    const scoreDelta = def ? def.score : 0;
    sessionScore += scoreDelta;

    blocks = state.blocks.map((b, i) =>
      i === blockIndex ? { ...b, remainingHits: 0, isDestroyed: true } : b,
    );
    events.push({ type: 'BlockDestroyed', blockId: block.id, scoreDelta });

    // Item drop — only if no item currently on screen
    if (def && def.dropItemType !== 'none' && state.itemDrops.length === 0) {
      const dropType = def.dropItemType;
      const itemDef = tables.itemDefinitions[dropType];
      const fallSpeed = itemDef ? itemDef.fallSpeed : 160;
      const newItem: ItemDropState = {
        id: `item_${block.id}`,
        itemType: dropType,
        x: block.x + 32, // center of 64px block
        y: block.y + 12, // center of 24px block
        fallSpeed,
        isCollected: false,
      };
      itemDrops = [...state.itemDrops, newItem];
      events.push({
        type: 'ItemSpawned',
        itemId: newItem.id,
        itemType: dropType,
        x: newItem.x,
        y: newItem.y,
      });
    }
  } else {
    // Block damaged but not destroyed
    blocks = state.blocks.map((b, i) =>
      i === blockIndex ? { ...b, remainingHits: newRemainingHits } : b,
    );
    events.push({ type: 'BlockHit', blockId: block.id, remainingHits: newRemainingHits });
  }

  const nextState: GameplayRuntimeState = {
    ...state,
    balls,
    blocks,
    itemDrops,
    session: { ...state.session, score: sessionScore },
  };
  return { state: nextState, events };
}

function resolveFloor(
  state: GameplayRuntimeState,
  fact: BallHitFloorFact,
): { state: GameplayRuntimeState; events: GameplayEvent[] } {
  const balls = state.balls.map((b) =>
    b.id === fact.ballId ? { ...b, isActive: false } : b,
  );
  // LifeLost event — remainingLives will be filled in by GameplayController after StageRuleService
  const events: GameplayEvent[] = [{ type: 'LifeLost', remainingLives: 0 }];
  return { state: { ...state, balls }, events };
}

function resolveItemPickedUp(
  state: GameplayRuntimeState,
  fact: ItemPickedUpFact,
  tables: Tables,
): { state: GameplayRuntimeState; events: GameplayEvent[] } {
  const item = state.itemDrops.find((i) => i.id === fact.itemId);
  if (!item) {
    return { state, events: [] };
  }

  const itemDrops = state.itemDrops.filter((i) => i.id !== fact.itemId);

  const replacedEffect = state.bar.activeEffect;
  const itemType = item.itemType;

  // expand/magnet/laser 모두 BarEffectService로 처리한다
  const barEffectService = new BarEffectService(tables.itemDefinitions);
  const effectResult = barEffectService.applyEffect(
    state.bar,
    state.magnetRemainingTime,
    state.laserCooldownRemaining,
    state.attachedBallIds,
    itemType,
    tables.config.baseBarWidth,
  );

  const events: GameplayEvent[] = [
    ...effectResult.events,
    {
      type: 'ItemCollected',
      itemType,
      replacedEffect,
      newEffect: effectResult.nextBar.activeEffect,
    },
  ];

  const nextState: GameplayRuntimeState = {
    ...state,
    bar: effectResult.nextBar,
    itemDrops,
    magnetRemainingTime: effectResult.nextMagnetRemaining,
    laserCooldownRemaining: effectResult.nextLaserCooldown,
    // laser → 타 효과 전환 시 비행 중인 샷도 함께 제거한다.
    laserShots: effectResult.clearLaserShots ? [] : state.laserShots,
    attachedBallIds: effectResult.nextAttachedBalls,
  };

  return { state: nextState, events };
}

function resolveItemFellOff(
  state: GameplayRuntimeState,
  fact: ItemFellOffFloorFact,
): { state: GameplayRuntimeState; events: GameplayEvent[] } {
  const itemDrops = state.itemDrops.filter((i) => i.id !== fact.itemId);
  return { state: { ...state, itemDrops }, events: [] };
}

// --- Main export ---

export function applyCollisions(
  initialState: GameplayRuntimeState,
  collisions: CollisionFact[],
  tables: Tables,
  options: ApplyOptions = {},
): ApplyResult {
  let state = initialState;
  const allEvents: GameplayEvent[] = [];
  const skipBlockReflection = options.blockReflectionAlreadyApplied ?? false;

  for (const fact of collisions) {
    let result: { state: GameplayRuntimeState; events: GameplayEvent[] };

    switch (fact.type) {
      case 'BallHitWall':
        result = resolveWall(state, fact);
        break;
      case 'BallHitBar':
        result = resolveBar(state, fact);
        break;
      case 'BallHitBlock':
        result = resolveBlock(state, fact, tables, skipBlockReflection);
        break;
      case 'BallHitFloor':
        result = resolveFloor(state, fact);
        break;
      case 'ItemPickedUp':
        result = resolveItemPickedUp(state, fact, tables);
        break;
      case 'ItemFellOffFloor':
        result = resolveItemFellOff(state, fact);
        break;
    }

    state = result.state;
    for (const e of result.events) {
      allEvents.push(e);
    }
  }

  return { nextState: state, events: allEvents };
}
