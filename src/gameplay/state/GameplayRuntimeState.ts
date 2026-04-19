import type { GameSessionState } from './GameSessionState';
import type { BarState } from './BarState';
import type { BallState } from './BallState';
import type { BlockState } from './BlockState';
import type { ItemDropState } from './ItemDropState';
import type { LaserShotState } from './LaserShotState';
import type { SpinnerRuntimeState } from './SpinnerRuntimeState';

export type GameplayRuntimeState = {
  session: GameSessionState;
  bar: BarState;
  balls: BallState[];
  blocks: BlockState[];
  itemDrops: ItemDropState[];
  isStageCleared: boolean;
  /** 자석 효과 남은 시간 (ms). 0이면 비활성. */
  magnetRemainingTime: number;
  /** 자석 상태에서 바에 붙은 공 ID 목록. */
  attachedBallIds: readonly string[];
  /** 레이저 다음 발사까지 남은 쿨다운 (ms). 0이면 즉시 발사 가능. */
  laserCooldownRemaining: number;
  /** 화면에 존재하는 레이저 발사체 목록. */
  laserShots: readonly LaserShotState[];
  /** 현재 스테이지의 회전체 런타임 상태 목록. */
  spinnerStates: readonly SpinnerRuntimeState[];
};
