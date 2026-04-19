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

  it('spinners 없는 스테이지 → spinnerStates = []', () => {
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

  it('spinnerStates x, y가 placement에서 올바르게 복사된다', () => {
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
    expect(state.spinnerStates[0]!.y).toBe(250);
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
