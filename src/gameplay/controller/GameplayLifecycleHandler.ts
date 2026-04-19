import type { StageDefinition } from '../../definitions/types/StageDefinition';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { GameplayRuntimeState } from '../state/GameplayRuntimeState';
import { createGameplayRuntimeFromStageDefinition } from '../systems/StageRuntimeFactory';

const BAR_HEIGHT = 16;

/**
 * Flow 상태 전환에 따라 GameplayRuntimeState 를 초기화하거나 리셋한다.
 *
 * - initializeStage: IntroStory→RoundIntro 진입 시 (새 게임 시작). StageRuntimeFactory 호출.
 * - resetForRetry: LifeLost→RoundIntro 진입 시. 블록 상태·점수·라이프 유지,
 *   공 위치와 바 위치만 재설정, 아이템 낙하 제거.
 *   activeEffect 리셋 정책: 알카노이드 관례에 따라 바 효과를 리셋한다
 *   (activeEffect='none', bar.width=baseBarWidth).
 * - loadNextStage: StageCleared→RoundIntro 진입 시. session.score/lives 유지,
 *   블록은 새 스테이지 데이터로 완전 재구성, 공/바 리셋, itemDrops 제거.
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
      // 자석/레이저 효과 타이머 초기화
      magnetRemainingTime: 0,
      attachedBallIds: [],
      laserCooldownRemaining: 0,
      laserShots: [],
      // spinnerStates 는 스테이지 내 보존 (회전체는 LifeLost 후에도 유지)
    };
  }

  /**
   * 스테이지 클리어 후 다음 스테이지를 로드한다.
   * session.score 와 session.lives 는 유지된다 (스테이지 간 누적).
   * 블록은 새 스테이지 데이터로 완전 재구성된다.
   * 공/바 위치는 새 스테이지 spawn 좌표로 리셋된다.
   * 아이템 낙하는 제거된다.
   * 바 효과는 리셋된다 (activeEffect='none', width=baseBarWidth).
   * isStageCleared 는 false 로 재설정된다.
   * session.currentStageIndex 는 호출자(AppContext)가 명시적으로 세팅한다.
   */
  loadNextStage(
    currentState: GameplayRuntimeState,
    nextStage: StageDefinition,
    config: GameplayConfig,
  ): GameplayRuntimeState {
    // 새 스테이지 블록 생성은 StageRuntimeFactory 를 재사용하되
    // session.score / lives / highScore 는 currentState 에서 유지한다.
    const freshState = createGameplayRuntimeFromStageDefinition(
      nextStage,
      config,
      this.blockDefinitions,
      currentState.session.lives, // 현재 라이프 유지
    );

    // freshState 는 StageRuntimeFactory 에서 생성되므로:
    //   - magnet/laser 관련 필드가 모두 0/빈배열로 초기화됨
    //   - spinnerStates 는 새 스테이지 definition 기반으로 재생성됨
    return {
      ...freshState,
      session: {
        ...freshState.session,
        score: currentState.session.score,
        lives: currentState.session.lives,
        highScore: currentState.session.highScore,
        // currentStageIndex: 호출자(AppContext)가 덮어씀
      },
      isStageCleared: false,
    };
  }
}
