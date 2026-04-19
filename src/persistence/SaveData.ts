export type SaveData = {
  highScore: number;
};

export const createDefaultSaveData = (): SaveData => ({ highScore: 0 });
