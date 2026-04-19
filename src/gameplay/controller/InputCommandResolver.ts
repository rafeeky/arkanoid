import type { InputSnapshot } from '../../input/InputSnapshot';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';

export type MoveBarCommand = {
  type: 'MoveBar';
  direction: -1 | 0 | 1;
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
  | LaunchBallCommand
  | ReleaseAttachedBallsCommand
  | FireLaserCommand;

export function resolveGameplayCommands(
  input: InputSnapshot,
  state: GameplayRuntimeState,
): GameplayCommand[] {
  const commands: GameplayCommand[] = [];

  let direction: -1 | 0 | 1 = 0;
  if (input.leftDown && !input.rightDown) {
    direction = -1;
  } else if (input.rightDown && !input.leftDown) {
    direction = 1;
  }
  commands.push({ type: 'MoveBar', direction });

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
