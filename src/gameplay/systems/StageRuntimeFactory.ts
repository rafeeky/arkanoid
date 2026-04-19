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

// ---------------------------------------------------------------------------
// 회전체 원 궤도 clamp 상수
// canvas 720x720, CIRCLE_RADIUS=60, CIRCLE_CLAMP_MARGIN=10
// circleCenterX ∈ [CIRCLE_RADIUS + CIRCLE_CLAMP_MARGIN, CANVAS_WIDTH - CIRCLE_RADIUS - CIRCLE_CLAMP_MARGIN]
//              = [70, 650]
// circleCenterY ∈ [MIN_CIRCLE_CENTER_Y, CANVAS_HEIGHT - CIRCLE_RADIUS - BAR_CLEARANCE]
//              = [380, 580]
// 궤도 y 범위 = [380-60, 580+60] = [320, 640]. 바(660)와 20px 여유.
// ---------------------------------------------------------------------------
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 720;
const BAR_CLEARANCE = 80;
const CIRCLE_CLAMP_MARGIN = 10;

/**
 * 원 궤도 중심 y 하한.
 * 블록 영역(상단)을 침범하지 않도록 명시적 상수로 고정한다.
 * 궤도 최상단 = MIN_CIRCLE_CENTER_Y - CIRCLE_RADIUS = 380 - 60 = 320.
 */
const MIN_CIRCLE_CENTER_Y = 380;

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

/**
 * clamp 헬퍼: min 이상 max 이하로 값을 제한한다.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildSpinnerStates(def: StageDefinition): readonly SpinnerRuntimeState[] {
  if (!def.spinners || def.spinners.length === 0) {
    return [];
  }
  return def.spinners.map((placement, index) => {
    const spawnX = placement.x;
    const descentEndY = placement.y;

    // circleCenterX: 원이 좌우 캔버스 경계를 벗어나지 않도록 clamp
    const circleCenterX = clamp(
      spawnX,
      CIRCLE_RADIUS + CIRCLE_CLAMP_MARGIN,
      CANVAS_WIDTH - CIRCLE_RADIUS - CIRCLE_CLAMP_MARGIN,
    );

    // circleCenterY: descentEndY 자체를 원 중심으로 사용.
    // 블록 영역 침범 방지(하한 380)와 바 근처 침범 방지(상한 580)로 clamp.
    const circleCenterY = clamp(
      descentEndY,
      MIN_CIRCLE_CENTER_Y,
      CANVAS_HEIGHT - CIRCLE_RADIUS - BAR_CLEARANCE,
    );

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
