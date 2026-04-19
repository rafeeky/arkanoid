export type ScreenState = {
  currentScreen: 'title' | 'roundIntro' | 'inGame' | 'gameOver';
  roundIntroRemainingTime: number;
  blockHitFlashBlockIds: string[];
  isBarBreaking: boolean;
};
