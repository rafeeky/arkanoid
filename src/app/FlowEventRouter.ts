import type { FlowEvent } from '../flow/events/flowEvents';
import type { GameplayEvent } from '../gameplay/events/gameplayEvents';
import type { GameplayRuntimeState } from '../gameplay/state/GameplayRuntimeState';
import type { GameplayController } from '../gameplay/controller/GameplayController';
import type { GameFlowController } from '../flow/controller/GameFlowController';
import type { GameplayLifecycleHandler } from '../gameplay/controller/GameplayLifecycleHandler';
import type { AudioCueResolver } from '../audio/AudioCueResolver';
import type { ISaveRepository } from '../persistence/ISaveRepository';
import type { IAudioPlayer } from '../audio/IAudioPlayer';
import type { GameplayConfig } from '../definitions/types/GameplayConfig';
import type { StageDefinition } from '../definitions/types/StageDefinition';
import type { DevContext } from './dev/DevContext';
import type { CollisionLogEntry } from './dev/CollisionLog';

/**
 * FlowEventRouter — Flow / Gameplay 이벤트를 각 서비스로 라우팅한다.
 *
 * 책임:
 * - Flow 이벤트 수신 → audio 라우팅 + save 트리거 + stage 로드 결정
 * - Gameplay 이벤트 수신 → audio 라우팅 + Flow 중계
 * - Dev 이벤트 수신 → CollisionLog / BallTrail / Invariant / Replay 기록
 *
 * audioPlayer는 setAudioPlayer 로 교체 가능하므로 getAudioPlayer 콜백 방식으로 주입받는다.
 *
 * Unity 매핑: AppContext 조립 계층(GameManager Adapter)에서만 사용하는 순수 라우터.
 * MonoBehaviour는 아니며, 엔진 API에 의존하지 않는다.
 */
export class FlowEventRouter {
  private readonly getAudioPlayer: () => IAudioPlayer;
  private readonly audioCueResolver: AudioCueResolver;
  private readonly gameplayController: GameplayController;
  private readonly flowController: GameFlowController;
  private readonly lifecycleHandler: GameplayLifecycleHandler;
  private readonly saveRepository: ISaveRepository;
  private readonly config: GameplayConfig;
  private readonly stageDefinitions: readonly StageDefinition[];
  private readonly devContext: DevContext | undefined;

  constructor(deps: {
    getAudioPlayer: () => IAudioPlayer;
    audioCueResolver: AudioCueResolver;
    gameplayController: GameplayController;
    flowController: GameFlowController;
    lifecycleHandler: GameplayLifecycleHandler;
    saveRepository: ISaveRepository;
    config: GameplayConfig;
    stageDefinitions: readonly StageDefinition[];
    devContext?: DevContext;
  }) {
    this.getAudioPlayer = deps.getAudioPlayer;
    this.audioCueResolver = deps.audioCueResolver;
    this.gameplayController = deps.gameplayController;
    this.flowController = deps.flowController;
    this.lifecycleHandler = deps.lifecycleHandler;
    this.saveRepository = deps.saveRepository;
    this.config = deps.config;
    this.stageDefinitions = deps.stageDefinitions;
    this.devContext = deps.devContext;
  }

  /**
   * Flow 이벤트를 처리한다.
   *
   * - Audio 라우팅: Flow 이벤트 → AudioCueResolver → AudioPlayer
   * - Save 트리거: EnteredGameOver / EnteredGameClear 시 highScore 갱신 + 저장
   * - Stage 로드: EnteredRoundIntro 발생 경로(from)에 따라 initializeStage / loadNextStage / resetForRetry
   */
  onFlowEvent(event: FlowEvent): void {
    this.routeFlowAudio(event);
    this.handleFlowLifecycle(event);
  }

  /**
   * Gameplay 이벤트를 처리한다.
   *
   * - Flow 중계: flowController.handleGameplayEvent
   * - Audio 라우팅: Gameplay 이벤트 → AudioCueResolver → AudioPlayer
   * - Dev 기록: CollisionLog push (devContext가 활성일 때만)
   */
  onGameplayEvent(event: GameplayEvent, currentTick: number): void {
    this.flowController.handleGameplayEvent(event);
    this.routeGameplayAudio(event);
    this.recordDevCollision(event, currentTick);
  }

  // ---------------------------------------------------------------------------
  // Private: Audio routing
  // ---------------------------------------------------------------------------

  private routeFlowAudio(event: FlowEvent): void {
    const audioPlayer = this.getAudioPlayer();
    if (event.type === 'EnteredRoundIntro' && event.from === 'introStory') {
      // jingle(round_start) + UiConfirm 모두 재생
      const roundCues = this.audioCueResolver.resolveCueIds('EnteredRoundIntro');
      for (const cue of roundCues) {
        audioPlayer.play(cue);
      }
      const confirmCues = this.audioCueResolver.resolveCueIds('UiConfirm');
      for (const cue of confirmCues) {
        audioPlayer.play(cue);
      }
    } else if (
      event.type === 'EnteredTitle' &&
      (event.from === 'gameOver' || event.from === 'gameClear')
    ) {
      // UiConfirm SFX + 타이틀 BGM 재개
      const confirmCues = this.audioCueResolver.resolveCueIds('UiConfirm');
      for (const cue of confirmCues) {
        audioPlayer.play(cue);
      }
      const titleCues = this.audioCueResolver.resolveCueIds('EnteredTitle');
      for (const cue of titleCues) {
        audioPlayer.play(cue);
      }
    } else {
      // 그 외 Flow 이벤트는 eventType 기반 직접 매핑
      const cues = this.audioCueResolver.resolveCueIds(event.type);
      for (const cue of cues) {
        audioPlayer.play(cue);
      }
    }
  }

  private routeGameplayAudio(event: GameplayEvent): void {
    const audioPlayer = this.getAudioPlayer();
    const audioCues = this.audioCueResolver.resolveCueIds(event.type);
    for (const cue of audioCues) {
      audioPlayer.play(cue);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Flow lifecycle (stage load + save)
  // ---------------------------------------------------------------------------

  private handleFlowLifecycle(event: FlowEvent): void {
    if (event.type === 'EnteredRoundIntro') {
      this.handleEnteredRoundIntro(event.from);
    } else if (event.type === 'EnteredGameOver' || event.type === 'EnteredGameClear') {
      this.handleEnteredResult();
    }
  }

  private handleEnteredRoundIntro(from: string): void {
    if (from === 'introStory') {
      // 인트로 종료 후 첫 스테이지 시작: Stage 0 완전 초기화, 현재 highScore 유지
      const currentHighScore = this.gameplayController.getState().session.highScore;
      const stage0 = this.stageDefinitions[0]!;
      const newState = this.lifecycleHandler.initializeStage(stage0, this.config, this.config.initialLives);
      this.gameplayController.setState({
        ...newState,
        session: { ...newState.session, highScore: currentHighScore, currentStageIndex: 0 },
      });
    } else if (from === 'inGame') {
      // inGame → RoundIntro: StageCleared(다음 스테이지) vs LifeLost(재시도) 구분
      // Flow 가 이미 currentStageIndex 를 증가시킨 상태이므로 비교 가능
      const currentGameplayState = this.gameplayController.getState() as GameplayRuntimeState;
      const flowStageIndex = this.flowController.getState().currentStageIndex;
      const gameplayStageIndex = currentGameplayState.session.currentStageIndex;

      if (flowStageIndex !== gameplayStageIndex) {
        // StageCleared 경로: 다음 스테이지 로드 (score/lives 유지, 블록 재구성)
        const nextStage = this.stageDefinitions[flowStageIndex];
        if (nextStage === undefined) {
          // 스테이지 정의 없음 — 방어적 처리 (GameClear 가 이미 처리했어야 하는 케이스)
          return;
        }
        const nextState = this.lifecycleHandler.loadNextStage(
          currentGameplayState,
          nextStage,
          this.config,
        );
        this.gameplayController.setState({
          ...nextState,
          session: { ...nextState.session, currentStageIndex: flowStageIndex },
        });
      } else {
        // LifeLost 경로: 같은 스테이지 재시도 (블록/점수/라이프 유지, 위치만 리셋)
        const currentStage =
          this.stageDefinitions[gameplayStageIndex] ?? this.stageDefinitions[0]!;
        const resetState = this.lifecycleHandler.resetForRetry(
          currentGameplayState,
          currentStage,
          this.config,
        );
        this.gameplayController.setState(resetState);
      }
    }
  }

  private handleEnteredResult(): void {
    // 저장 시점: GameOver / GameClear 진입 시 highScore 갱신 후 저장 (fire-and-forget)
    const session = this.gameplayController.getState().session;
    const newHighScore = Math.max(session.highScore, session.score);
    if (newHighScore > session.highScore) {
      const updatedState = this.gameplayController.getState() as GameplayRuntimeState;
      this.gameplayController.setState({
        ...updatedState,
        session: { ...updatedState.session, highScore: newHighScore },
      });
    }
    this.saveRepository.save({ highScore: newHighScore }).catch((err: unknown) => {
      console.warn('[FlowEventRouter] saveRepository.save 실패:', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Private: Dev collision recording
  // ---------------------------------------------------------------------------

  private recordDevCollision(event: GameplayEvent, currentTick: number): void {
    const devContext = this.devContext;
    if (!devContext?.isEnabled) return;

    const state = this.gameplayController.getState();
    const ball = state.balls[0];
    const ballSnapshot = ball
      ? { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy }
      : { x: 0, y: 0, vx: 0, vy: 0 };

    let logEntry: CollisionLogEntry | undefined;

    if (event.type === 'BlockHit') {
      logEntry = {
        tick: currentTick,
        time: Date.now(),
        ball: ballSnapshot,
        target: { kind: 'block', id: event.blockId },
      };
    } else if (event.type === 'BlockDestroyed') {
      logEntry = {
        tick: currentTick,
        time: Date.now(),
        ball: ballSnapshot,
        target: { kind: 'block', id: event.blockId },
      };
    } else if (event.type === 'LifeLost') {
      logEntry = {
        tick: currentTick,
        time: Date.now(),
        ball: ballSnapshot,
        target: { kind: 'floor' },
      };
    }

    if (logEntry !== undefined) {
      devContext.collisionLog.push(logEntry);
    }
  }
}
