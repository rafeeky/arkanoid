export type SpinnerRuntimeState = {
  id: string;           // e.g. `spinner_0`, `spinner_1`
  definitionId: string; // SpinnerDefinitionTable 참조
  x: number;
  y: number;
  angleRad: number;     // 현재 회전각 (0 ~ 2π 주기)
};
