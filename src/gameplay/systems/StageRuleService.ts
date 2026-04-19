import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import type { GameplayEvent } from '../events/gameplayEvents';

export type StageOutcome =
  | { kind: 'none' }
  | { kind: 'clear' }
  | { kind: 'lifeLost'; remainingLives: number }
  | { kind: 'gameOver' };

/**
 * Judges the stage outcome for the current tick.
 *
 * Priority: gameOver > lifeLost > clear > none
 *
 * This function does NOT mutate state and does NOT emit events.
 * The caller (GameplayController) is responsible for updating state and emitting events.
 *
 * @param state   The gameplay state AFTER collision resolution.
 * @param events  The events emitted by CollisionResolutionService this tick.
 */
export function judgeStageOutcome(
  state: GameplayRuntimeState,
  events: GameplayEvent[],
): StageOutcome {
  const hasLifeLostEvent = events.some((e) => e.type === 'LifeLost');

  if (hasLifeLostEvent) {
    const remainingLives = state.session.lives - 1;
    if (remainingLives <= 0) {
      return { kind: 'gameOver' };
    }
    return { kind: 'lifeLost', remainingLives };
  }

  const allBlocksDestroyed =
    state.blocks.length > 0 && state.blocks.every((b) => b.isDestroyed);

  if (allBlocksDestroyed) {
    return { kind: 'clear' };
  }

  return { kind: 'none' };
}
