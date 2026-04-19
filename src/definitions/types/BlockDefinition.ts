export type BlockDefinition = {
  definitionId: string;
  maxHits: number;
  score: number;
  dropItemType: 'none' | 'expand' | 'magnet' | 'laser';
  visualId: string;
};
