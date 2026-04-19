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

type ApplyResult = {
  nextState: GameplayRuntimeState;
  events: GameplayEvent[];
};

type Tables = {
  blockDefinitions: Record<string, BlockDefinition>;
  itemDefinitions: Record<string, ItemDefinition>;
  config: GameplayConfig;
};

// --- Reflection helpers ---

function reflectBallWall(ball: BallState, fact: BallHitWallFact): BallState {
  if (fact.side === 'left' || fact.side === 'right') {
    return { ...ball, vx: -ball.vx };
  }
  // top
  return { ...ball, vy: -ball.vy };
}

/**
 * Bar reflection.
 * vy is always forced negative (upward).
 * vx is biased by barContactX: center → small vx, edges → larger vx.
 * Speed magnitude is preserved.
 *
 * Formula:
 *   vx = contactX * speed * 0.7
 *   vy = -sqrt(speed^2 - vx^2)   (always upward)
 */
function reflectBallBar(ball: BallState, fact: BallHitBarFact): BallState {
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const newVx = fact.barContactX * speed * 0.7;
  // Ensure vy has enough magnitude; clamp to avoid pure horizontal trajectory
  const vyMagnitude = Math.sqrt(Math.max(speed * speed - newVx * newVx, (speed * 0.3) ** 2));
  return { ...ball, vx: newVx, vy: -vyMagnitude };
}

/**
 * Block reflection based on which side was hit.
 */
function reflectBallBlock(ball: BallState, fact: BallHitBlockFact): BallState {
  if (fact.side === 'left' || fact.side === 'right') {
    return { ...ball, vx: -ball.vx };
  }
  return { ...ball, vy: -ball.vy };
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

function resolveBar(
  state: GameplayRuntimeState,
  fact: BallHitBarFact,
): { state: GameplayRuntimeState; events: GameplayEvent[] } {
  const balls = state.balls.map((b) =>
    b.id === fact.ballId ? reflectBallBar(b, fact) : b,
  );
  return { state: { ...state, balls }, events: [] };
}

function resolveBlock(
  state: GameplayRuntimeState,
  fact: BallHitBlockFact,
  tables: Tables,
): { state: GameplayRuntimeState; events: GameplayEvent[] } {
  const events: GameplayEvent[] = [];

  // Reflect ball
  let balls = state.balls.map((b) =>
    b.id === fact.ballId ? reflectBallBlock(b, fact) : b,
  );

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
      const itemDef = tables.itemDefinitions[def.dropItemType];
      const fallSpeed = itemDef ? itemDef.fallSpeed : 160;
      const newItem: ItemDropState = {
        id: `item_${block.id}`,
        itemType: 'expand',
        x: block.x + 32, // center of 64px block
        y: block.y + 12, // center of 24px block
        fallSpeed,
        isCollected: false,
      };
      itemDrops = [...state.itemDrops, newItem];
      events.push({
        type: 'ItemSpawned',
        itemId: newItem.id,
        itemType: 'expand',
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
  const itemDef = tables.itemDefinitions[item.itemType];
  const expandMultiplier = itemDef ? itemDef.expandMultiplier : tables.config.expandMultiplier;

  const newBar: BarState = {
    ...state.bar,
    activeEffect: 'expand',
    width: tables.config.baseBarWidth * expandMultiplier,
  };

  const events: GameplayEvent[] = [
    {
      type: 'ItemCollected',
      itemType: 'expand',
      replacedEffect,
      newEffect: 'expand',
    },
  ];

  return {
    state: { ...state, bar: newBar, itemDrops },
    events,
  };
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
): ApplyResult {
  let state = initialState;
  const allEvents: GameplayEvent[] = [];

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
        result = resolveBlock(state, fact, tables);
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
