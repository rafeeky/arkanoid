import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';
import type { BarState } from '../state/BarState';
import type { ItemDropState } from '../state/ItemDropState';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { ItemDefinition } from '../../definitions/types/ItemDefinition';
import type { GameplayConfig, PhysicsConfig } from '../../definitions/types/GameplayConfig';
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
import { BAR_HEIGHT, BALL_RADIUS } from './playfieldLayout';
import * as Wall from '../entities/Wall';
import * as Bar from '../entities/Bar';
import * as Block from '../entities/Block';

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

// --- Minimum angle enforcement ---

/**
 * Ensures the velocity vector is never closer than `minAngleDeg` to either axis
 * (horizontal or vertical). Speed magnitude is preserved.
 *
 * - If |vx|/speed < sin(minAngleDeg), vx is clamped to ±(speed * sin(...)) and
 *   vy is recalculated.
 * - Likewise for |vy|.
 * - Normal angles (>minAngleDeg from both axes) are not modified.
 *
 * Exported so that MovementSystem can apply the same constraint after swept
 * block reflections. `minAngleDeg` is a required parameter — caller passes
 * `config.physics.minAngleDeg` (data-driven, not a code const).
 */
export function enforceMinAngle(
  vx: number,
  vy: number,
  minAngleDeg: number,
): { vx: number; vy: number } {
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed === 0) return { vx, vy };

  const minSin = Math.sin((minAngleDeg * Math.PI) / 180);
  const minComponent = speed * minSin;
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

// --- Resolution helpers ---
//
// 반사 로직 자체는 entity 모듈이 소유 (성모님 원칙: 콜리전이 오브젝트에 종속).
//   Wall.reflectFromBall  — src/gameplay/entities/Wall.ts
//   Bar.reflectFromBall   — src/gameplay/entities/Bar.ts
//   Block.reflectFromBall — src/gameplay/entities/Block.ts
// 이 파일은 fact → entity reflect 호출 → state 갱신의 orchestration 만.

function resolveWall(
  state: GameplayRuntimeState,
  fact: BallHitWallFact,
  physics: PhysicsConfig,
): { state: GameplayRuntimeState; events: GameplayEvent[] } {
  const balls = state.balls.map((b) =>
    b.id === fact.ballId ? Wall.reflectFromBall(b, fact, physics) : b,
  );
  return { state: { ...state, balls }, events: [] };
}

function resolveBar(
  state: GameplayRuntimeState,
  fact: BallHitBarFact,
  physics: PhysicsConfig,
): { state: GameplayRuntimeState; events: GameplayEvent[] } {
  // 자석 상태에서 활성 공이 바에 닿으면 반사 대신 부착
  if (state.bar.activeEffect === 'magnet') {
    const targetBall = state.balls.find((b) => b.id === fact.ballId);
    if (targetBall && targetBall.isActive) {
      // 자석 부착도 paddle 접촉 — 파워 상태 reset.
      const attached = Bar.attachBall(targetBall, state.bar);
      const attachedBall = { ...attached, blocksSincePaddle: 0, isPowered: false };
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

  // 일반 상태: 반사 + 파워 상태 reset (blocksSincePaddle=0, isPowered=false).
  const balls = state.balls.map((b) => {
    if (b.id !== fact.ballId) return b;
    const reflected = Bar.reflectFromBall(b, fact, physics);
    return { ...reflected, blocksSincePaddle: 0, isPowered: false };
  });
  return {
    state: { ...state, balls },
    events: [{ type: 'BallHitBar', ballId: fact.ballId }],
  };
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
    : state.balls.map((b) =>
        b.id === fact.ballId
          ? Block.reflectFromBall(b, fact.side, tables.config.physics)
          : b,
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

    // 공 파워 상태 — destroyed 1회당 blocksSincePaddle += 1.
    // 2 이상 도달 시 isPowered=true (시각 트레일 트리거 전용, 게임플레이 영향 X).
    // 바 충돌 시 resolveBar 가 0/false 로 reset.
    const POWER_THRESHOLD = 2;
    balls = balls.map((b) => {
      if (b.id !== fact.ballId) return b;
      const newCount = (b.blocksSincePaddle ?? 0) + 1;
      return { ...b, blocksSincePaddle: newCount, isPowered: newCount >= POWER_THRESHOLD };
    });

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

  // 2026-05-18: magnet 5회 / laser 6초 — 새 필드 초기화.
  // ItemDefinition 의 magnetUseCount / laserDurationMs 우선 사용. 미설정 시 기본값.
  const newEffect = effectResult.nextBar.activeEffect;
  const itemDef = tables.itemDefinitions[itemType];
  const magnetUses = newEffect === 'magnet' ? (itemDef?.magnetUseCount ?? 5) : 0;
  const laserTime = newEffect === 'laser' ? (itemDef?.laserDurationMs ?? 6000) : 0;

  const nextState: GameplayRuntimeState = {
    ...state,
    bar: effectResult.nextBar,
    itemDrops,
    magnetRemainingTime: effectResult.nextMagnetRemaining,
    magnetRemainingUses: magnetUses,
    laserCooldownRemaining: effectResult.nextLaserCooldown,
    laserRemainingTime: laserTime,
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
        result = resolveWall(state, fact, tables.config.physics);
        break;
      case 'BallHitBar':
        result = resolveBar(state, fact, tables.config.physics);
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
