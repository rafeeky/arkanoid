import type { BlockDefinition } from '../types/BlockDefinition';

export const BlockDefinitionTable: Record<string, BlockDefinition> = {
  basic: {
    definitionId: 'basic',
    maxHits: 1,
    score: 10,
    dropItemType: 'none',
    visualId: 'block_basic',
  },
  basic_drop: {
    definitionId: 'basic_drop',
    maxHits: 1,
    score: 10,
    dropItemType: 'expand',
    visualId: 'block_basic_drop',
  },
  tough: {
    definitionId: 'tough',
    maxHits: 2,
    score: 30,
    dropItemType: 'none',
    visualId: 'block_tough',
  },
};
