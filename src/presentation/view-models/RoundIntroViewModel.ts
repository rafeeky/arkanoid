export type RoundIntroViewModel = {
  roundLabel: string;
  readyLabel: string;
  /**
   * introProgress: 0.0(연출 시작) ~ 1.0(연출 종료).
   * roundIntroRemainingTime / roundIntroDurationMs 를 1 에서 뺀 값.
   * fade-in/out 연출에 사용.
   */
  introProgress: number;
};
