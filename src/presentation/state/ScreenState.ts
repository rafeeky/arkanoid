export type ScreenState = {
  currentScreen: 'title' | 'introStory' | 'roundIntro' | 'inGame' | 'gameOver' | 'gameClear';
  roundIntroRemainingTime: number;
  blockHitFlashBlockIds: string[];
  isBarBreaking: boolean;
};
