import type { StageDefinition } from '../../definitions/types/StageDefinition';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import { createGameplayRuntimeFromStageDefinition } from '../systems/StageRuntimeFactory';

const BAR_HEIGHT = 16;

/**
 * Flow 상태 전환에 따라 GameplayRuntimeState 를 초기화하거나 리셋한다.
 *
 * - initializeStage: Title→RoundIntro 진입 시 (새 게임 시작). StageRuntimeFactory 호출.
 * - resetForRetry: LifeLost→RoundIntro 진입 시. 블록 상태·점수·라이프 유지,
 *   공 위치와 바 위치만 재설정, 아이템 낙하 제거.
 *   activeEffect 리셋 정책: 알카노이드 관례에 따라 바 효과를 리셋한다
 *   (activeEffect='none', bar.width=baseBarWidth).
 */
export class GameplayLifecycleHandler {
  private readonly blockDefinitions: Record<string, BlockDefinition>;

  constructor(blockDefinitions: Record<string, BlockDefinition>) {
    this.blockDefinitions = blockDefinitions;
  }

  /**
   * 스테이지 정의로부터 완전히 새로운 GameplayRuntimeState 를 생성한다.
   * Title → RoundIntro 전이 시 호출.
   */
  initializeStage(
    stage: StageDefinition,
    config: GameplayConfig,
    initialLives: number,
  ): GameplayRuntimeState {
    return createGameplayRuntimeFromStageDefinition(
      stage,
      config,
      this.blockDefinitions,
      initialLives,
    );
  }

  /**
   * 라이프 손실 후 재시도를 위해 런타임 상태를 부분 리셋한다.
   * 블록 상태, 점수, 라이프는 유지된다.
   * 공은 비활성으로 바 위로 재배치된다.
   * 아이템 낙하는 모두 제거된다.
   * 바 효과는 리셋된다 (activeEffect='none', width=baseBarWidth).
   */
  resetForRetry(
    currentState: GameplayRuntimeState,
    stage: StageDefinition,
    config: GameplayConfig,
  ): GameplayRuntimeState {
    const resetBar = {
      ...currentState.bar,
      x: stage.barSpawnX,
      y: stage.barSpawnY,
      width: config.baseBarWidth,
      activeEffect: 'none' as const,
    };

    const resetBalls = currentState.balls.map((ball) => ({
      ...ball,
      isActive: false,
      vx: 0,
      vy: 0,
      x: stage.barSpawnX,
      y: stage.barSpawnY - BAR_HEIGHT,
    }));

    return {
      ...currentState,
      bar: resetBar,
      balls: resetBalls,
      itemDrops: [],
    };
  }
}
