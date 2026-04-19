/**
 * SpinnerRuntimeState
 *
 * 회전체 1개의 런타임 상태.
 *
 * phase:
 *   'spawning'   — gate 열림 연출 시간 (400ms). spinner는 y=0 고정, 충돌 비활성(ghost).
 *   'descending' — 느린 선형 하강 (80 px/s). y = 0 → descentEndY. x = spawnX 고정.
 *                  충돌 비활성(ghost).
 *   'circling'   — 원 궤도 이동. circleCenter 주위 radius=150, 1.5 rad/s.
 *                  충돌 활성(solid).
 *
 * 자체 회전(angleRad)은 모든 phase에서 계속 증가한다.
 */

export type SpinnerPhase = 'spawning' | 'descending' | 'circling';

export type SpinnerRuntimeState = {
  id: string;             // e.g. `spinner_0`, `spinner_1`
  definitionId: string;   // SpinnerDefinitionTable 참조
  x: number;              // 현재 x (spawning/descending에선 spawnX, circling에선 cos 궤도)
  y: number;              // 현재 y (spawning: 0, descending: 선형 증가, circling: sin 궤도)
  angleRad: number;       // 자체 회전각 (계속 증가, normalizeAngle 적용)
  phase: SpinnerPhase;
  spawnElapsedMs: number; // spawning phase 경과 시간 (gate 애니메이션 동기)
  descentEndY: number;    // descending → circling 전환 y (StageDefinition.spinner.y)
  circleCenterX: number;  // 원 중심 x (기본: spawnX)
  circleCenterY: number;  // 원 중심 y (기본: descentEndY + circleRadius)
  circleRadius: number;   // 원 반지름 (기본값 150)
  circleAngleRad: number; // 원 궤도상 현재 각도 (0~2π)
  spawnX: number;         // 초기 x (spawning/descending 동안 x 고정에 사용)
};
