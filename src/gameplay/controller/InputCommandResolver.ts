import type { InputSnapshot } from '../../input/InputSnapshot';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';

export type MoveBarCommand = {
  type: 'MoveBar';
  direction: -1 | 0 | 1;
};

/** 슬라이더 드래그 — 바를 절대 x 좌표로 스냅 (playfield 좌표). */
export type SetBarTargetXCommand = {
  type: 'SetBarTargetX';
  x: number;
};

export type LaunchBallCommand = {
  type: 'LaunchBall';
};

export type ReleaseAttachedBallsCommand = {
  type: 'ReleaseAttachedBalls';
};

export type FireLaserCommand = {
  type: 'FireLaser';
};

export type GameplayCommand =
  | MoveBarCommand
  | SetBarTargetXCommand
  | LaunchBallCommand
  | ReleaseAttachedBallsCommand
  | FireLaserCommand;

export function resolveGameplayCommands(
  input: InputSnapshot,
  state: GameplayRuntimeState,
): GameplayCommand[] {
  const commands: GameplayCommand[] = [];

  // 포인터 드래그가 활성이면 절대 위치로 바 스냅. 키보드 좌우는 무시 (드래그 우선).
  if (input.targetBarX !== undefined) {
    commands.push({ type: 'SetBarTargetX', x: input.targetBarX });
  } else {
    let direction: -1 | 0 | 1 = 0;
    if (input.leftDown && !input.rightDown) {
      direction = -1;
    } else if (input.rightDown && !input.leftDown) {
      direction = 1;
    }
    commands.push({ type: 'MoveBar', direction });
  }

  if (input.spaceJustPressed) {
    // 우선순위 1: 자석 상태 + 부착 공 있음 → 해제
    if (state.bar.activeEffect === 'magnet' && state.attachedBallIds.length > 0) {
      commands.push({ type: 'ReleaseAttachedBalls' });
    }
    // 우선순위 2: 레이저 상태 + 쿨타임 없음 → 발사
    else if (state.bar.activeEffect === 'laser' && state.laserCooldownRemaining <= 0) {
      commands.push({ type: 'FireLaser' });
    }
    // 우선순위 3: 비활성 공 있음 → 발사
    else if (state.balls.some((b) => !b.isActive)) {
      commands.push({ type: 'LaunchBall' });
    }
    // 그 외: 커맨드 없음
  }

  return commands;
}
