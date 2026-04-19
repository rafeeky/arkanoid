/**
 * GameClearViewModel — GameClear 화면 표시용 ViewModel.
 *
 * ScreenPresenter.buildGameClearViewModel() 이 생성한다.
 *
 * Unity 매핑: GameClearView MonoBehaviour의 입력 데이터.
 */
export type GameClearViewModel = {
  /** "CONGRATULATIONS" */
  headline: string;
  /** "FINAL SCORE 1234" */
  finalScoreLabel: string;
  /** "HIGH SCORE 5678" */
  highScoreLabel: string;
  /** "PRESS SPACE TO RETRY" */
  retryText: string;
  /** 신규 기록 여부 — 하이라이트 색상 판단에 사용 */
  isNewHighScore: boolean;
};
