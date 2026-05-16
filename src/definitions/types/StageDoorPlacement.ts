/**
 * Stage JSON 의 문(door) 한 칸 배치 정보.
 *
 * 위치: 상단 테두리만. col 단위 (BORDER_LENGTH 픽셀). row 는 항상 0.
 * 같은 col 에 BorderBlock 이 있으면 door 가 우선 (door 가 border 를 대체).
 */
export type StageDoorPlacement = {
  col: number;
  /** 열렸을 때 spawn 할 스피너 definition id. */
  spinnerDefinitionId: string;
};
