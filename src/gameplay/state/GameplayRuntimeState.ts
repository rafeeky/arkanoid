import type { GameSessionState } from './GameSessionState';
import type { BarState } from './BarState';
import type { BallState } from './BallState';
import type { BlockState } from './BlockState';
import type { ItemDropState } from './ItemDropState';

export type GameplayRuntimeState = {
  session: GameSessionState;
  bar: BarState;
  balls: BallState[];
  blocks: BlockState[];
  itemDrops: ItemDropState[];
  isStageCleared: boolean;
};
