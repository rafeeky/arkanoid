export type BlockDefinition = {
  definitionId: string;
  maxHits: number;
  score: number;
  dropItemType: 'none' | 'expand';
  visualId: string;
};
