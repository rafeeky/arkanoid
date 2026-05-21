import type { GameSessionState } from './GameSessionState';
import type { BarState } from './BarState';
import type { BallState } from './BallState';
import type { BlockState } from './BlockState';
import type { BorderBlockState } from './BorderBlockState';
import type { DoorState } from './DoorState';
import type { ItemDropState } from './ItemDropState';
import type { LaserShotState } from './LaserShotState';
import type { SpinnerRuntimeState } from './SpinnerRuntimeState';
import type { TrailStyleId } from '../../definitions/tables/TrailStyleTable';

export type GameplayRuntimeState = {
  session: GameSessionState;
  bar: BarState;
  balls: BallState[];
  blocks: BlockState[];
  /** 플레이필드 테두리 (좌/우/상단). 깨지지 않는 벽. */
  borders: readonly BorderBlockState[];
  /** 상단 테두리 위 문(door). 열리면 스피너 spawn. */
  doors: readonly DoorState[];
  itemDrops: ItemDropState[];
  isStageCleared: boolean;
  /** @deprecated 자석 효과 남은 시간 (ms). 호환용 유지 — 새 동작은 magnetRemainingUses 사용 예정. */
  magnetRemainingTime: number;
  /** 자석 효과 남은 부착 횟수 (5회). 미설정 시 0. 시스템 로직 변경 turn 에서 활성화. */
  magnetRemainingUses?: number;
  /** 자석 상태에서 바에 붙은 공 ID 목록. */
  attachedBallIds: readonly string[];
  /** 레이저 다음 발사까지 남은 쿨다운 (ms). 0이면 즉시 발사 가능. */
  laserCooldownRemaining: number;
  /** 레이저 효과 남은 지속 시간 (ms). 미설정 시 0. 시스템 로직 변경 turn 에서 활성화. */
  laserRemainingTime?: number;
  /** 화면에 존재하는 레이저 발사체 목록. */
  laserShots: readonly LaserShotState[];
  /** 현재 스테이지의 회전체 런타임 상태 목록. */
  spinnerStates: readonly SpinnerRuntimeState[];
  /** 현재 스테이지의 공 파워 트레일 스타일. StageRuntimeFactory 에서 세팅. */
  currentTrailStyle?: TrailStyleId;
};
