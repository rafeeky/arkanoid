export type InputSnapshot = {
  leftDown: boolean;
  rightDown: boolean;
  spaceJustPressed: boolean;
  /** Q 키 edge — 타이틀 복귀용 (묶음 F). 기본 false. */
  qJustPressed?: boolean;
  /** ESC 키 edge — InGame 일시정지 토글. 기본 false. */
  escJustPressed?: boolean;
  /** ← edge — 타이틀 난이도 커서 NORMAL 선택 (묶음 E). 기본 false. */
  leftJustPressed?: boolean;
  /** → edge — 타이틀 난이도 커서 HARD 선택 (묶음 E). 기본 false. */
  rightJustPressed?: boolean;
  /**
   * 마우스/터치 드래그 시 바 목표 x 좌표 (TS 좌표계, undefined 면 미사용) (묶음 H1).
   * 데스크톱 마우스도 동일 경로로 처리.
   */
  targetBarX?: number;
};
