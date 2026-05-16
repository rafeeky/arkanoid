/**
 * DoorState — 상단 테두리 위에 배치되는 게이트.
 *
 * 좌표 규약: (x, y) 좌상단. orientation 은 항상 'horizontal' (상단 한정).
 *
 * Phase:
 *   - 'closed'  → BorderBlock 처럼 작동. 공/스피너 모두 차단.
 *   - 'opening' → 왼쪽으로 슬라이드 애니. 공은 차단, 스피너는 아직 spawn 전.
 *   - 'opened'  → 사라진 상태. 공은 여전히 차단 (사용자 결정), 스피너는 통과 가능.
 *
 * Checkpoint B: 'closed' 만 구현. opening/opened 는 C/D 에서.
 */
export type DoorPhase = 'closed' | 'opening' | 'opened';

export type DoorState = {
  id: string;
  x: number;
  y: number;
  phase: DoorPhase;
  /** opening 시작 후 경과 시간 (ms). 0 이면 시작 안 됨. */
  openingElapsedMs: number;
  /** 열리면 어떤 스피너가 spawn 될지. */
  spinnerDefinitionId: string;
  /** opened 후 생성된 spinner 의 id. 아직 없으면 null. */
  spawnedSpinnerId: string | null;
};
