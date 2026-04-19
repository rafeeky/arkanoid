/**
 * SpinnerRuntimeState
 *
 * 회전체 1개의 런타임 상태.
 *
 * phase:
 *   'spawning' — 상단 입구(y=0)에서 targetY로 하강 중. 충돌 비활성(ghost).
 *   'active'   — targetY에 정착. 회전 + 충돌 활성.
 *
 * spawnProgress: 0~1. 0=입구(y=0), 1=targetY 도달.
 * targetY: 최종 정착 y 좌표 (StageDefinition의 spinner.y).
 */

export type SpinnerPhase = 'spawning' | 'active';

export type SpinnerRuntimeState = {
  id: string;           // e.g. `spinner_0`, `spinner_1`
  definitionId: string; // SpinnerDefinitionTable 참조
  x: number;
  y: number;            // 현재 y 위치 (spawning 중엔 이동)
  angleRad: number;     // 현재 회전각 (0 ~ 2π 주기)
  phase: SpinnerPhase;
  targetY: number;      // 최종 정착 y
  spawnProgress: number; // 0~1. 0=입구, 1=targetY 도달
};
