import type { InputSnapshot } from '../../input/InputSnapshot';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { ItemDefinition } from '../../definitions/types/ItemDefinition';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { GameplayEvent } from '../events/gameplayEvents';

import { resolveGameplayCommands } from './InputCommandResolver';
import { moveBar, moveBallSubSteps, moveItemDrop, moveAttachedBallToBar } from '../systems/MovementSystem';
import { detectCollisions, probeSubStepCollision } from '../systems/CollisionService';
import { applyCollisions } from '../systems/CollisionResolutionService';
import { judgeStageOutcome } from '../systems/StageRuleService';

type Dependencies = {
  blockDefinitions: Record<string, BlockDefinition>;
  itemDefinitions: Record<string, ItemDefinition>;
  config: GameplayConfig;
};

export class GameplayController {
  private state: GameplayRuntimeState;
  private readonly deps: Dependencies;

  constructor(initialState: GameplayRuntimeState, deps: Dependencies) {
    this.state = initialState;
    this.deps = deps;
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
      }
    }

    // 4. Movement
    const prevState = this.state;

    const newBar = moveBar(this.state.bar, moveDirection, dt, this.deps.config);
    const currentBlocks = this.state.blocks;
    const newBalls = this.state.balls.map((ball) => {
      const moved = moveBallSubSteps(ball, dt, (candidate) =>
        probeSubStepCollision(
          candidate.x,
          candidate.y,
          candidate.vx,
          candidate.vy,
          currentBlocks,
          newBar,
          ball.vy,
        ),
      );
      return moveAttachedBallToBar(moved, newBar);
    });
    const newItemDrops = this.state.itemDrops.map((item) => moveItemDrop(item, dt));

    this.state = {
      ...this.state,
      bar: newBar,
      balls: newBalls,
      itemDrops: newItemDrops,
    };

    // 5. Detect collisions
    const collisions = detectCollisions(this.state, prevState);

    // 6. Apply collision results
    const { nextState, events: collisionEvents } = applyCollisions(
      this.state,
      collisions,
      {
        blockDefinitions: this.deps.blockDefinitions,
        itemDefinitions: this.deps.itemDefinitions,
        config: this.deps.config,
      },
    );
    this.state = nextState;
    for (const e of collisionEvents) {
      allEvents.push(e);
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
