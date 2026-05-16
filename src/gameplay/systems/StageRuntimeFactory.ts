import type { StageDefinition } from '../../definitions/types/StageDefinition';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { DifficultyConfig } from '../../definitions/types/DifficultyConfig';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { BlockState } from '../state/BlockState';
import type { BorderBlockState } from '../state/BorderBlockState';
import type { DoorState } from '../state/DoorState';
import type { SpinnerRuntimeState } from '../state/SpinnerRuntimeState';
import {
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  BLOCK_GAP,
  BLOCK_GRID_LEFT_MARGIN,
  BLOCK_GRID_START_Y,
  BAR_HEIGHT,
  BORDER_LENGTH,
  BORDER_THICKNESS,
  PLAYFIELD_WIDTH,
  CIRCLE_RADIUS,
  INITIAL_LAUNCH_OFFSET_X,
  clampSpinnerCenter,
} from './playfieldLayout';

// 모든 좌표 상수는 ./playfieldLayout 단일 소스에서 import.
// 편집기(`src/editor/`)도 동일 모듈 사용 — 두 곳 동기화 보장.

/**
 * Creates the initial GameplayRuntimeState from a StageDefinition.
 * Does not read external state. Requires definitions to look up block maxHits.
 *
 * difficulty (묶음 E):
 * - 주어지면 difficulty.initialLives 가 initialLives 인자를 override.
 * - difficulty.spinnersEnabled === false 이면 스피너 목록을 비운다 (NORMAL 난이도).
 * - 미지정 시 기존 동작 (모든 스피너 활성, initialLives 사용).
 */
export function createGameplayRuntimeFromStageDefinition(
  def: StageDefinition,
  config: GameplayConfig,
  blockDefinitions: Record<string, BlockDefinition>,
  initialLives: number,
  difficulty?: DifficultyConfig,
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

  const borders = buildBorderStates(def);
  const doors = buildDoorStates(def);

  // 난이도 적용: SpinnersEnabled=false → 스피너 목록 비움. InitialLives 우선 적용.
  const spinnerStates = (difficulty && !difficulty.spinnersEnabled)
    ? []
    : buildSpinnerStates(def);
  const effectiveLives = difficulty?.initialLives ?? initialLives;

  return {
    session: {
      currentStageIndex: 0,
      score: 0,
      lives: effectiveLives,
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
        // 발사 각도(-60°, 우측 위) 와 시각 일치 — 바 중심에서 우측 30px.
        x: def.barSpawnX + INITIAL_LAUNCH_OFFSET_X,
        y: def.barSpawnY - BAR_HEIGHT,
        vx: 0,
        vy: 0,
        isActive: false,
      },
    ],
    blocks,
    borders,
    doors,
    itemDrops: [],
    isStageCleared: false,
    magnetRemainingTime: 0,
    attachedBallIds: [],
    laserCooldownRemaining: 0,
    laserShots: [],
    spinnerStates,
  };
}

/**
 * StageDefinition.borders 의 grid 좌표 (row, col, orientation) 를
 * 실제 픽셀 좌표(좌상단) 로 변환해 BorderBlockState 배열로 만든다.
 *
 * - horizontal (상단): row=0 기준. x = col * BORDER_LENGTH, y = 0.
 * - vertical (좌/우): col=0 (좌) 또는 col=last (우) 기준. x = col==0 ? 0 : PLAYFIELD_WIDTH - BORDER_THICKNESS. y = row * BORDER_LENGTH.
 *
 * 좌/우 col 값은 0 이면 왼쪽, 1 이면 오른쪽으로 해석한다 (binary edge).
 */
/**
 * StageDefinition.doors → DoorState 배열. 모두 'closed' 상태로 초기화.
 * 위치: 상단 테두리 라인 (y=0). col 단위로 BORDER_LENGTH 픽셀씩.
 */
function buildDoorStates(def: StageDefinition): readonly DoorState[] {
  if (!def.doors || def.doors.length === 0) {
    return [];
  }
  return def.doors.map((placement, index) => ({
    id: `door_${index}`,
    x: placement.col * BORDER_LENGTH,
    y: 0,
    phase: 'closed' as const,
    openingElapsedMs: 0,
    spinnerDefinitionId: placement.spinnerDefinitionId,
    spawnedSpinnerId: null,
  }));
}

function buildBorderStates(def: StageDefinition): readonly BorderBlockState[] {
  if (!def.borders || def.borders.length === 0) {
    return [];
  }
  return def.borders.map((placement, index) => {
    let x: number;
    let y: number;
    if (placement.orientation === 'horizontal') {
      x = placement.col * BORDER_LENGTH;
      y = placement.row * BORDER_THICKNESS;
    } else {
      // vertical: col=0 → left edge, col=1 → right edge
      x = placement.col === 0 ? 0 : PLAYFIELD_WIDTH - BORDER_THICKNESS;
      y = placement.row * BORDER_LENGTH;
    }
    return {
      id: `border_${index}`,
      x,
      y,
      orientation: placement.orientation,
    };
  });
}

function buildSpinnerStates(def: StageDefinition): readonly SpinnerRuntimeState[] {
  if (!def.spinners || def.spinners.length === 0) {
    return [];
  }
  return def.spinners.map((placement, index) => {
    const spawnX = placement.x;
    const descentEndY = placement.y;

    // 원 궤도 중심 — playfieldLayout.clampSpinnerCenter 사용 (편집기도 동일 호출).
    const { centerX: circleCenterX, centerY: circleCenterY } = clampSpinnerCenter(spawnX, descentEndY);

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
