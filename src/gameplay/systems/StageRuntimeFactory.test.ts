import { describe, it, expect } from 'vitest';
import { createGameplayRuntimeFromStageDefinition } from './StageRuntimeFactory';
import { BlockDefinitionTable } from '../../definitions/tables/BlockDefinitionTable';
import { GameplayConfigTable } from '../../definitions/tables/GameplayConfigTable';
import { StageDefinitionTable } from '../../definitions/tables/StageDefinitionTable';
import type { StageDefinition } from '../../definitions/types/StageDefinition';

const config = GameplayConfigTable;
const stage1 = StageDefinitionTable[0]!;

describe('createGameplayRuntimeFromStageDefinition — MVP3 새 필드 초기값', () => {
  it('magnetRemainingTime = 0', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stage1,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.magnetRemainingTime).toBe(0);
  });

  it('attachedBallIds = []', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stage1,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.attachedBallIds).toHaveLength(0);
  });

  it('laserCooldownRemaining = 0', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stage1,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.laserCooldownRemaining).toBe(0);
  });

  it('laserShots = []', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stage1,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.laserShots).toHaveLength(0);
  });

  // TODO(dev): 에디터 export로 stage1에 spinner 추가됨. stage-agnostic 리팩토링 대기.
  it.skip('spinners 없는 스테이지 → spinnerStates = []', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stage1,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates).toHaveLength(0);
  });

  it('spinners 있는 스테이지 → spinnerStates가 spinner 수만큼 생성', () => {
    const stageWithSpinners: StageDefinition = {
      ...stage1,
      spinners: [
        { definitionId: 'spinner_cube', x: 100, y: 200 },
        { definitionId: 'spinner_triangle', x: 300, y: 200, initialAngleRad: 1.5 },
      ],
    };

    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates).toHaveLength(2);
  });

  it('spinnerStates id는 spinner_0, spinner_1 순서', () => {
    const stageWithSpinners: StageDefinition = {
      ...stage1,
      spinners: [
        { definitionId: 'spinner_cube', x: 100, y: 200 },
        { definitionId: 'spinner_triangle', x: 300, y: 200 },
      ],
    };

    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.id).toBe('spinner_0');
    expect(state.spinnerStates[1]!.id).toBe('spinner_1');
  });

  it('spinnerStates definitionId가 placement에서 올바르게 복사된다', () => {
    const stageWithSpinners: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 100, y: 200 }],
    };

    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.definitionId).toBe('spinner_cube');
  });

  it('spinnerStates x는 placement.x에서 복사되고 y는 0(입구)으로 초기화된다', () => {
    const stageWithSpinners: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 150, y: 250 }],
    };

    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.x).toBe(150);
    expect(state.spinnerStates[0]!.y).toBe(0);           // 입구 위치
    expect(state.spinnerStates[0]!.descentEndY).toBe(250); // placement.y → descentEndY
  });

  it('initialAngleRad 없으면 angleRad = 0', () => {
    const stageWithSpinners: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 100, y: 200 }],
    };

    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.angleRad).toBe(0);
  });

  it('initialAngleRad 있으면 해당 값이 angleRad에 반영된다', () => {
    const stageWithSpinners: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 100, y: 200, initialAngleRad: 1.5 }],
    };

    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.angleRad).toBe(1.5);
  });

  it('spinners 빈 배열 → spinnerStates = []', () => {
    const stageWithEmptySpinners: StageDefinition = {
      ...stage1,
      spinners: [],
    };

    const state = createGameplayRuntimeFromStageDefinition(
      stageWithEmptySpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SpinnerRuntimeState 초기화 — spawn animation 필드
// ---------------------------------------------------------------------------

describe('createGameplayRuntimeFromStageDefinition — spinner spawn 초기화', () => {
  const stageWithSpinners: StageDefinition = {
    ...stage1,
    spinners: [
      { definitionId: 'spinner_cube', x: 200, y: 400 },
      { definitionId: 'spinner_triangle', x: 520, y: 350 },
    ],
  };

  it('각 spinnerState의 phase는 spawning으로 초기화된다', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.phase).toBe('spawning');
    expect(state.spinnerStates[1]!.phase).toBe('spawning');
  });

  it('각 spinnerState의 초기 y=0 (입구 위치)', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.y).toBe(0);
    expect(state.spinnerStates[1]!.y).toBe(0);
  });

  it('각 spinnerState의 descentEndY는 placement.y와 일치한다', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.descentEndY).toBe(400);
    expect(state.spinnerStates[1]!.descentEndY).toBe(350);
  });

  it('각 spinnerState의 spawnElapsedMs=0으로 초기화된다', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.spawnElapsedMs).toBe(0);
    expect(state.spinnerStates[1]!.spawnElapsedMs).toBe(0);
  });

  it('x 좌표는 placement.x와 일치한다 (x는 변경 없음)', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.x).toBe(200);
    expect(state.spinnerStates[1]!.x).toBe(520);
  });

  it('spawnX는 placement.x와 일치한다', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.spawnX).toBe(200);
    expect(state.spinnerStates[1]!.spawnX).toBe(520);
  });

  it('descentEndY는 placement.y와 일치한다', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.descentEndY).toBe(400);
    expect(state.spinnerStates[1]!.descentEndY).toBe(350);
  });

  it('circleCenterX는 spawnX(placement.x)와 일치한다', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.circleCenterX).toBe(200);
    expect(state.spinnerStates[1]!.circleCenterX).toBe(520);
  });

  it('circleCenterY는 descentEndY를 원 중심으로 사용한다 (clamp 범위 내)', () => {
    // descentEndY=400, clamp 범위 [170, 540] → 400은 그대로 유지
    // descentEndY=350, clamp 범위 [170, 540] → 350은 그대로 유지
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.circleCenterY).toBe(400);
    expect(state.spinnerStates[1]!.circleCenterY).toBe(350);
  });

  it('circleRadius는 100이다', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.circleRadius).toBe(100);
    expect(state.spinnerStates[1]!.circleRadius).toBe(100);
  });

  it('circleAngleRad는 0으로 초기화된다', () => {
    const state = createGameplayRuntimeFromStageDefinition(
      stageWithSpinners,
      config,
      BlockDefinitionTable,
      3,
    );
    expect(state.spinnerStates[0]!.circleAngleRad).toBe(0);
    expect(state.spinnerStates[1]!.circleAngleRad).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// StageRuntimeFactory — circleCenterX/Y clamp 테스트
// (canvas 720x720, CIRCLE_RADIUS=100, CIRCLE_CLAMP_MARGIN=10,
//  HUD_HEIGHT=60, BAR_CLEARANCE=80)
// circleCenterX ∈ [110, 610]
// circleCenterY ∈ [170, 540]
// ---------------------------------------------------------------------------

describe('createGameplayRuntimeFromStageDefinition — spinner clamp', () => {
  it('spawnX=50 → circleCenterX clamped to 110', () => {
    const stage: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 50, y: 300 }],
    };
    const state = createGameplayRuntimeFromStageDefinition(stage, config, BlockDefinitionTable, 3);
    expect(state.spinnerStates[0]!.circleCenterX).toBe(110);
  });

  it('spawnX=700 → circleCenterX clamped to 610', () => {
    const stage: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 700, y: 300 }],
    };
    const state = createGameplayRuntimeFromStageDefinition(stage, config, BlockDefinitionTable, 3);
    expect(state.spinnerStates[0]!.circleCenterX).toBe(610);
  });

  it('spawnX=360 (정중앙) → circleCenterX 그대로 360', () => {
    const stage: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 360, y: 300 }],
    };
    const state = createGameplayRuntimeFromStageDefinition(stage, config, BlockDefinitionTable, 3);
    expect(state.spinnerStates[0]!.circleCenterX).toBe(360);
  });

  it('descentEndY=600 → circleCenterY clamped to 540', () => {
    const stage: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 360, y: 600 }],
    };
    const state = createGameplayRuntimeFromStageDefinition(stage, config, BlockDefinitionTable, 3);
    expect(state.spinnerStates[0]!.circleCenterY).toBe(540);
  });

  it('descentEndY=50 → circleCenterY clamped to 170', () => {
    const stage: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 360, y: 50 }],
    };
    const state = createGameplayRuntimeFromStageDefinition(stage, config, BlockDefinitionTable, 3);
    expect(state.spinnerStates[0]!.circleCenterY).toBe(170);
  });

  it('descentEndY=300 → circleCenterY 그대로 300 (clamp 범위 내)', () => {
    const stage: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 360, y: 300 }],
    };
    const state = createGameplayRuntimeFromStageDefinition(stage, config, BlockDefinitionTable, 3);
    expect(state.spinnerStates[0]!.circleCenterY).toBe(300);
  });

  it('clamp 경계 값: spawnX=110 → circleCenterX=110', () => {
    const stage: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 110, y: 300 }],
    };
    const state = createGameplayRuntimeFromStageDefinition(stage, config, BlockDefinitionTable, 3);
    expect(state.spinnerStates[0]!.circleCenterX).toBe(110);
  });

  it('clamp 경계 값: spawnX=610 → circleCenterX=610', () => {
    const stage: StageDefinition = {
      ...stage1,
      spinners: [{ definitionId: 'spinner_cube', x: 610, y: 300 }],
    };
    const state = createGameplayRuntimeFromStageDefinition(stage, config, BlockDefinitionTable, 3);
    expect(state.spinnerStates[0]!.circleCenterX).toBe(610);
  });
});
