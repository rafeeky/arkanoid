/**
 * GameOverViewModel — GameOver 화면 표시용 ViewModel.
 *
 * ScreenPresenter.buildGameOverViewModel() 이 생성한다.
 *
 * Unity 매핑: GameOverView MonoBehaviour의 입력 데이터.
 */
export type GameOverViewModel = {
  /** "GAME OVER" */
  gameOverLabel: string;
  /** "FINAL SCORE 1234" — 템플릿 치환 완료된 문자열 */
  finalScoreLabel: string;
  /** "HIGH SCORE 5678" */
  highScoreLabel: string;
  /** "PRESS SPACE TO RETRY" */
  retryText: string;
  /** 신규 기록 여부 — 하이라이트 색상/라벨 표시 판단에 사용 */
  isNewHighScore: boolean;
};
