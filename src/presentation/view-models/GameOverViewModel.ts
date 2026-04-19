export type GameOverViewModel = {
  gameOverLabel: string;
  finalScore: number;
  retryText: string;
  /** 신규 기록 여부 — 하이라이트 색상/라벨 표시 판단에 사용 */
  isNewHighScore: boolean;
};
