import type { InputSnapshot } from '../../input/InputSnapshot';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';

export type MoveBarCommand = {
  type: 'MoveBar';
  direction: -1 | 0 | 1;
};

export type LaunchBallCommand = {
  type: 'LaunchBall';
};

export type GameplayCommand = MoveBarCommand | LaunchBallCommand;

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
    const hasInactiveBall = state.balls.some((b) => !b.isActive);
    if (hasInactiveBall) {
      commands.push({ type: 'LaunchBall' });
    }
  }

  return commands;
}
