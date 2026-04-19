import type { InputSnapshot } from '../../input/InputSnapshot';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { ItemDefinition } from '../../definitions/types/ItemDefinition';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import type { GameplayEvent } from '../events/gameplayEvents';

import { resolveGameplayCommands } from './InputCommandResolver';
import { moveBar, moveBallWithCollisions, moveItemDrop, moveAttachedBallToBar, sanityCheckBallBlockSeparation } from '../systems/MovementSystem';
import { detectCollisions } from '../systems/CollisionService';
import type { BallHitBlockFact, BallHitWallFact } from '../systems/CollisionService';
import { applyCollisions } from '../systems/CollisionResolutionService';
import { judgeStageOutcome } from '../systems/StageRuleService';
import { BarEffectService } from '../systems/BarEffectService';
import { LaserSystem } from '../systems/LaserSystem';
import { SpinnerSystem } from '../systems/SpinnerSystem';

type Dependencies = {
  blockDefinitions: Record<string, BlockDefinition>;
  itemDefinitions: Record<string, ItemDefinition>;
  config: GameplayConfig;
  spinnerDefinitions?: Record<string, SpinnerDefinition>;
};

export class GameplayController {
  private state: GameplayRuntimeState;
  private readonly deps: Dependencies;
  private readonly barEffectService: BarEffectService;
  private readonly laserSystem: LaserSystem;
  private readonly spinnerSystem: SpinnerSystem;
  private laserShotCounter = 0;

  constructor(initialState: GameplayRuntimeState, deps: Dependencies) {
    this.state = initialState;
    this.deps = deps;
    this.barEffectService = new BarEffectService(deps.itemDefinitions);
    this.laserSystem = new LaserSystem(() => `laser_${this.laserShotCounter++}`);
    this.spinnerSystem = new SpinnerSystem(deps.spinnerDefinitions ?? {});
  }

  getState(): Readonly<GameplayRuntimeState> {
    return this.state;
  }

  /**
   * 외부에서 상태를 교체한다.
   * AppContext 의 GameplayLifecycleHandler 가 새 스테이지 초기화 또는
   * 재시도 리셋 시 사용한다.
   */
  setState(newState: GameplayRuntimeState): void {
    this.state = newState;
  }

  /**
   * Advances the simulation by one tick.
   * Returns the Gameplay events emitted this tick.
   *
   * Tick order (mvp1.md §12):
   * 1. Resolve input commands
   * 2. Apply immediate commands (LaunchBall)
   * 3. Apply movement commands (MoveBar)
   * 4. Move all entities
   * 5. Detect collisions
   * 6. Apply collision results
   * 7. Judge stage outcome
   * 8. Emit final events
   */
  tick(input: InputSnapshot, dt: number): GameplayEvent[] {
    const allEvents: GameplayEvent[] = [];

    // 1. Resolve commands
    const commands = resolveGameplayCommands(input, this.state);

    // 2 & 3. Process commands
    let moveDirection: -1 | 0 | 1 = 0;
    for (const cmd of commands) {
      if (cmd.type === 'LaunchBall') {
        const { launchState, launchEvent } = this.applyLaunchBall();
        this.state = launchState;
        allEvents.push(launchEvent);
      } else if (cmd.type === 'MoveBar') {
        moveDirection = cmd.direction;
      } else if (cmd.type === 'ReleaseAttachedBalls') {
        const releaseResult = this.barEffectService.releaseManually(
          this.state.bar,
          this.state.attachedBallIds,
        );
        const releasedIds = new Set(releaseResult.releasedBallIds);
        const updatedBalls = this.state.balls.map((b) => {
          if (!releasedIds.has(b.id)) return b;
          return this.launchAttachedBall(b);
        });
        this.state = {
          ...this.state,
          bar: releaseResult.nextBar,
          balls: updatedBalls,
          attachedBallIds: [],
          magnetRemainingTime: 0,
        };
        for (const e of releaseResult.events) {
          allEvents.push(e);
        }
      } else if (cmd.type === 'FireLaser') {
        const laserItemDef = this.deps.itemDefinitions['laser'];
        const fireResult = this.laserSystem.fireLaser(
          this.state.bar,
          this.state.laserShots,
          laserItemDef?.laserCooldownMs,
        );
        this.state = {
          ...this.state,
          laserShots: fireResult.newShots,
          laserCooldownRemaining: fireResult.nextCooldownMs,
        };
        for (const e of fireResult.events) {
          allEvents.push(e);
        }
      }
    }

    // 4. Movement
    const prevState = this.state;

    const newBar = moveBar(this.state.bar, moveDirection, dt, this.deps.config);
    const currentBlocks = this.state.blocks;

    // Block and wall collisions are resolved inside moveBallWithCollisions (swept AABB).
    // Bar / item collisions remain in the detectCollisions pipeline below.
    // After swept movement, a post-tick sanity check pushes the ball out of any
    // block it may have entered due to floating-point drift or extreme dt.
    const accumulatedBlockFacts: BallHitBlockFact[] = [];
    const accumulatedSweptWallFacts: BallHitWallFact[] = [];
    const newBalls = this.state.balls.map((ball) => {
      const result = moveBallWithCollisions(ball, dt, currentBlocks);
      for (const f of result.blockFacts) {
        accumulatedBlockFacts.push(f);
      }
      for (const f of result.wallFacts) {
        accumulatedSweptWallFacts.push(f);
      }

      // Layer 2: post-tick sanity check — defensive last-resort separation.
      // This runs AFTER swept collision so it only fires when swept AABB misses.
      // If the ball centre is inside a block, push it out and add a collision
      // fact so block hit/destroy logic still fires for that block.
      const sanity = sanityCheckBallBlockSeparation(result.ball, currentBlocks);
      if (sanity.wasInside && sanity.collisionFact) {
        // Only add the fact if this block has not already been processed this tick
        const alreadyHit = accumulatedBlockFacts.some(
          (f) => f.blockId === sanity.collisionFact!.blockId,
        );
        if (!alreadyHit) {
          accumulatedBlockFacts.push(sanity.collisionFact);
        }
      }

      return moveAttachedBallToBar(sanity.ball, newBar);
    });
    const newItemDrops = this.state.itemDrops.map((item) => moveItemDrop(item, dt));

    this.state = {
      ...this.state,
      bar: newBar,
      balls: newBalls,
      itemDrops: newItemDrops,
    };

    // 5. Detect collisions (bar, item — block and wall facts already gathered above)
    const pipelineCollisions = detectCollisions(this.state, prevState);
    // Filter out BallHitBlock facts (handled by swept movement) and
    // BallHitWall facts for balls whose wall collision was already handled
    // inside moveBallWithCollisions to avoid double-reflecting the velocity.
    const sweptWallBallIds = new Set(accumulatedSweptWallFacts.map((f) => f.ballId));
    const barItemCollisions = pipelineCollisions.filter((f) => {
      if (f.type === 'BallHitBlock') return false; // already swept
      if (f.type === 'BallHitWall' && sweptWallBallIds.has(f.ballId)) return false; // already swept
      return true;
    });
    // accumulatedSweptWallFacts are intentionally NOT included here.
    // moveBallWithCollisions has already applied the velocity reflection for those
    // wall hits inside the swept loop. Passing them to applyCollisions would cause
    // reflectBallWall to flip vx a second time, restoring the pre-collision direction
    // and making the ball continue into the wall (or oscillate / stall).
    const collisions = [...accumulatedBlockFacts, ...barItemCollisions];

    // 6. Apply collision results
    // Block facts from moveBallWithCollisions have already had their velocity
    // reflections applied during the swept movement phase. The wall/bar/item
    // facts from the normal pipeline still need the full resolution (including
    // ball reflection for blocks from that pipeline, though we filter those out
    // above). We pass blockReflectionAlreadyApplied=true so that resolveBlock
    // does not double-reflect the velocity.
    const { nextState, events: collisionEvents } = applyCollisions(
      this.state,
      collisions,
      {
        blockDefinitions: this.deps.blockDefinitions,
        itemDefinitions: this.deps.itemDefinitions,
        config: this.deps.config,
      },
      { blockReflectionAlreadyApplied: true },
    );
    this.state = nextState;

    // 6a. 효과 교체로 인해 부착 공이 release된 경우 공을 활성화한다.
    // BarEffectService.applyEffect 가 BallsReleased(replaced)를 발행하면
    // CollisionResolutionService 는 attachedBallIds 만 비우지만 공 자체는 그대로다.
    // GameplayController 가 여기서 launchAttachedBall 을 통해 공을 활성화한다.
    for (const e of collisionEvents) {
      if (e.type === 'BallsReleased' && e.releaseReason === 'replaced' && e.ballIds.length > 0) {
        const replacedIds = new Set(e.ballIds);
        this.state = {
          ...this.state,
          balls: this.state.balls.map((b) =>
            replacedIds.has(b.id) ? this.launchAttachedBall(b) : b,
          ),
        };
      }
    }

    for (const e of collisionEvents) {
      allEvents.push(e);
    }

    // 6.4. Spinner tick — angleRad 업데이트 (정적 배치, 회전만)
    if (this.state.spinnerStates.length > 0) {
      const nextSpinnerStates = this.spinnerSystem.tick(this.state.spinnerStates, dt);
      this.state = { ...this.state, spinnerStates: nextSpinnerStates };
    }

    // 6.5. Magnet timer tick (dt를 ms로 변환)
    const magnetTick = this.barEffectService.tickMagnet(
      this.state.magnetRemainingTime,
      this.state.attachedBallIds,
      this.state.bar,
      dt * 1000,
    );
    if (magnetTick.releasedBallIds.length > 0) {
      const timedOutIds = new Set(magnetTick.releasedBallIds);
      const updatedBallsOnTimeout = this.state.balls.map((b) => {
        if (!timedOutIds.has(b.id)) return b;
        return this.launchAttachedBall(b);
      });
      this.state = {
        ...this.state,
        bar: magnetTick.nextBar,
        balls: updatedBallsOnTimeout,
        attachedBallIds: [],
        magnetRemainingTime: magnetTick.nextMagnetRemaining,
      };
    } else {
      this.state = {
        ...this.state,
        bar: magnetTick.nextBar,
        magnetRemainingTime: magnetTick.nextMagnetRemaining,
      };
    }
    for (const e of magnetTick.events) {
      allEvents.push(e);
    }

    // 6.55. Spinner ↔ Ball 충돌 처리
    if (this.state.spinnerStates.length > 0) {
      const updatedBalls = this.state.balls.map((ball) => {
        const result = this.spinnerSystem.handleBallCollisions(ball, this.state.spinnerStates);
        return result.nextBall;
      });
      this.state = { ...this.state, balls: updatedBalls };
    }

    // 6.6. Laser ↔ Block 충돌 처리 (이동 전 현재 위치 기준)
    if (this.state.laserShots.length > 0) {
      const laserCollision = this.laserSystem.handleBlockCollisions(
        this.state.laserShots,
        this.state.blocks,
        this.deps.blockDefinitions,
      );
      if (laserCollision.events.length > 0 || laserCollision.nextShots.length !== this.state.laserShots.length) {
        this.state = {
          ...this.state,
          laserShots: laserCollision.nextShots,
          blocks: [...laserCollision.nextBlocks],
          session: {
            ...this.state.session,
            score: this.state.session.score + laserCollision.scoreDelta,
          },
        };
        for (const e of laserCollision.events) {
          allEvents.push(e);
        }
      }
    }

    // 6.7. Laser tick: shots 이동 + 쿨다운 감소
    if (this.state.laserShots.length > 0 || this.state.laserCooldownRemaining > 0) {
      const laserTick = this.laserSystem.tick(
        this.state.laserShots,
        this.state.laserCooldownRemaining,
        dt,
      );
      this.state = {
        ...this.state,
        laserShots: laserTick.nextShots,
        laserCooldownRemaining: laserTick.nextCooldownMs,
      };
    }

    // 6.8. Spinner ↔ Block 충돌 처리 (phase-gate)
    if (this.state.spinnerStates.length > 0) {
      const spinnerBlockResult = this.spinnerSystem.handleBlockCollisions(
        this.state.spinnerStates,
        this.state.blocks,
        this.deps.blockDefinitions,
      );
      if (spinnerBlockResult.events.length > 0) {
        this.state = {
          ...this.state,
          blocks: [...spinnerBlockResult.nextBlocks],
          session: {
            ...this.state.session,
            score: this.state.session.score + spinnerBlockResult.scoreDelta,
          },
        };
        for (const e of spinnerBlockResult.events) {
          allEvents.push(e);
        }
      }
    }

    // 7. Judge stage outcome
    const outcome = judgeStageOutcome(this.state, collisionEvents);

    switch (outcome.kind) {
      case 'lifeLost': {
        // Update lives, fix up the LifeLost event's remainingLives
        this.state = {
          ...this.state,
          session: { ...this.state.session, lives: outcome.remainingLives },
        };
        // Replace the placeholder LifeLost event (remainingLives: 0) with correct value
        const remainingLives = outcome.remainingLives;
        const patchedLifeLost = allEvents.map((e) =>
          e.type === 'LifeLost' ? { type: 'LifeLost' as const, remainingLives } : e,
        );
        allEvents.length = 0;
        for (const e of patchedLifeLost) allEvents.push(e);
        break;
      }
      case 'gameOver': {
        this.state = {
          ...this.state,
          session: { ...this.state.session, lives: 0 },
        };
        // Fix up LifeLost event to have remainingLives = 0
        const patchedGameOver = allEvents.map((e) =>
          e.type === 'LifeLost' ? { type: 'LifeLost' as const, remainingLives: 0 } : e,
        );
        allEvents.length = 0;
        for (const e of patchedGameOver) allEvents.push(e);
        allEvents.push({ type: 'GameOverConditionMet' });
        break;
      }
      case 'clear': {
        this.state = { ...this.state, isStageCleared: true };
        allEvents.push({ type: 'StageCleared' });
        break;
      }
      case 'none':
        break;
    }

    return allEvents;
  }

  private applyLaunchBall(): {
    launchState: GameplayRuntimeState;
    launchEvent: GameplayEvent;
  } {
    const config = this.deps.config;
    const angleDeg = config.ballInitialAngleDeg;
    const angleRad = (angleDeg * Math.PI) / 180;
    const speed = config.ballInitialSpeed;

    // Standard math angle: 0 = right, positive = counterclockwise
    // Screen coordinate: y increases downward
    // angleDeg=-60 means 60 degrees above horizontal toward the right:
    //   vx = cos(-60°) = 0.5, vy = sin(-60°) = -0.866 (upward)
    const vx = Math.cos(angleRad) * speed;
    const vy = Math.sin(angleRad) * speed;

    // Only launch the first inactive ball
    let launched = false;
    const updatedBalls = this.state.balls.map((b) => {
      if (!b.isActive && !launched) {
        launched = true;
        return { ...b, isActive: true, vx, vy };
      }
      return b;
    });

    const launchState: GameplayRuntimeState = { ...this.state, balls: updatedBalls };
    const launchEvent: GameplayEvent = { type: 'BallLaunched' };
    return { launchState, launchEvent };
  }

  /**
   * 자석에서 해제된 공을 활성화하고 초기 속도를 부여한다.
   * 각도와 속도는 config를 따른다.
   * attachedOffsetX 필드를 제거해 발사 대기 상태로 복원한다.
   */
  private launchAttachedBall(ball: import('../state/BallState').BallState): import('../state/BallState').BallState {
    const config = this.deps.config;
    const angleDeg = config.ballInitialAngleDeg;
    const angleRad = (angleDeg * Math.PI) / 180;
    const speed = config.ballInitialSpeed;
    const vx = Math.cos(angleRad) * speed;
    const vy = Math.sin(angleRad) * speed;
    // exactOptionalPropertyTypes: undefined 직접 할당 불가 → 필드 제거
    const { attachedOffsetX: _removed, ...rest } = ball;
    void _removed;
    return {
      ...rest,
      isActive: true,
      vx,
      vy,
    };
  }

  /**
   * Resets the ball(s) to their initial inactive positions above the bar.
   * Called externally when returning from RoundIntro after a life loss.
   */
  resetBallsToBar(): void {
    const balls = this.state.balls.map((b) => ({
      ...b,
      isActive: false,
      vx: 0,
      vy: 0,
      x: this.state.bar.x,
      y: this.state.bar.y - 16,
    }));
    this.state = { ...this.state, balls };
  }
}
