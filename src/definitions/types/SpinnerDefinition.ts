export type SpinnerKind = 'cube' | 'triangle';

export type SpinnerDefinition = {
  definitionId: string;
  kind: SpinnerKind;
  size: number;                         // 외접원 지름 (px)
  rotationSpeedRadPerSec: number;
  /** 블록 충돌 허용 위상 (라디안). 큐브: [0, π/2]. 삼각: [0] */
  blockCollisionPhases: readonly number[];
};
