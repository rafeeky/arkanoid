export type IntroPhase = 'typing' | 'hold' | 'erasing' | 'done';

export type ScreenState = {
  currentScreen: 'title' | 'introStory' | 'roundIntro' | 'inGame' | 'gameOver' | 'gameClear';
  roundIntroRemainingTime: number;
  blockHitFlashBlockIds: string[];
  isBarBreaking: boolean;
  /** 현재 재생 중인 intro 페이지 인덱스 (0..N-1) */
  introPageIndex: number;
  /** 현재 페이지 내부 표시 진행률 0~1 */
  introTypingProgress: number;
  /** 현재 페이지 내부 phase */
  introPhase: IntroPhase;
};

export function createInitialScreenState(roundIntroDurationMs: number): ScreenState {
  return {
    currentScreen: 'title',
    roundIntroRemainingTime: roundIntroDurationMs,
    blockHitFlashBlockIds: [],
    isBarBreaking: false,
    introPageIndex: 0,
    introTypingProgress: 0,
    introPhase: 'typing',
  };
}
