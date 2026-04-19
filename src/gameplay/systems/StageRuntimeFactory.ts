import type { StageDefinition } from '../../definitions/types/StageDefinition';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { BlockState } from '../state/BlockState';
import type { SpinnerRuntimeState } from '../state/SpinnerRuntimeState';
import { CIRCLE_RADIUS } from './SpinnerSystem';

const BLOCK_WIDTH = 64;
const BLOCK_HEIGHT = 24;
const BLOCK_GRID_START_Y = 80;
const BLOCK_GRID_LEFT_MARGIN = 56;
const BLOCK_GAP = 4;
const BAR_HEIGHT = 16;

/**
 * Creates the initial GameplayRuntimeState from a StageDefinition.
 * Does not read external state. Requires definitions to look up block maxHits.
 */
export function createGameplayRuntimeFromStageDefinition(
  def: StageDefinition,
  config: GameplayConfig,
  blockDefinitions: Record<string, BlockDefinition>,
  initialLives: number,
): GameplayRuntimeState {
  const blocks: BlockState[] = def.blocks.map((placement, index) => {
    const x = BLOCK_GRID_LEFT_MARGIN + placement.col * (BLOCK_WIDTH + BLOCK_GAP);
    const y = BLOCK_GRID_START_Y + placement.row * (BLOCK_HEIGHT + BLOCK_GAP);
    const blockDef = blockDefinitions[placement.definitionId];
    const maxHits = blockDef ? blockDef.maxHits : 1;

    return {
      id: `block_${index}`,
      x,
      y,
      remainingHits: maxHits,
      isDestroyed: false,
      definitionId: placement.definitionId,
    };
  });

  return {
    session: {
      currentStageIndex: 0,
      score: 0,
      lives: initialLives,
      highScore: 0,
    },
    bar: {
      x: def.barSpawnX,
      y: def.barSpawnY,
      width: config.baseBarWidth,
      moveSpeed: config.barMoveSpeed,
      activeEffect: 'none',
    },
    balls: [
      {
        id: 'ball_0',
        x: def.ballSpawnX,
        y: def.barSpawnY - BAR_HEIGHT,
        vx: 0,
        vy: 0,
        isActive: false,
      },
    ],
    blocks,
    itemDrops: [],
    isStageCleared: false,
    magnetRemainingTime: 0,
    attachedBallIds: [],
    laserCooldownRemaining: 0,
    laserShots: [],
    spinnerStates: buildSpinnerStates(def),
  };
}

function buildSpinnerStates(def: StageDefinition): readonly SpinnerRuntimeState[] {
  if (!def.spinners || def.spinners.length === 0) {
    return [];
  }
  return def.spinners.map((placement, index) => {
    const spawnX = placement.x;
    const descentEndY = placement.y;
    const circleCenterX = spawnX;
    const circleCenterY = descentEndY + CIRCLE_RADIUS;

    return {
      id: `spinner_${index}`,
      definitionId: placement.definitionId,
      x: spawnX,
      y: 0,
      angleRad: placement.initialAngleRad ?? 0,
      phase: 'spawning' as const,
      spawnElapsedMs: 0,
      descentEndY,
      circleCenterX,
      circleCenterY,
      circleRadius: CIRCLE_RADIUS,
      circleAngleRad: 0,
      spawnX,
    };
  });
}
