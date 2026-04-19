import { GameFlowController } from '../flow/controller/GameFlowController';
import { GameplayController } from '../gameplay/controller/GameplayController';
import { GameplayLifecycleHandler } from '../gameplay/controller/GameplayLifecycleHandler';
import { ScreenDirector } from '../presentation/controller/ScreenDirector';
import { VisualEffectController } from '../presentation/controller/VisualEffectController';
import type { GameFlowState } from '../flow/state/GameFlowState';
import type { GameplayRuntimeState } from '../gameplay/state/GameplayRuntimeState';
import type { ScreenState } from '../presentation/state/ScreenState';
import type { InputSnapshot } from '../input/InputSnapshot';
import type { FlowEvent } from '../flow/events/flowEvents';
import type { GameplayEvent } from '../gameplay/events/gameplayEvents';
import type { PresentationEvent } from '../presentation/events/presentationEvents';
import type { ISaveRepository } from '../persistence/ISaveRepository';
import { InMemorySaveRepository } from '../persistence/InMemorySaveRepository';
import type { IAudioPlayer } from '../audio/IAudioPlayer';
import { NoopAudioPlayer } from '../audio/NoopAudioPlayer';
import { AudioCueResolver } from '../audio/AudioCueResolver';
import { AudioCueTable } from '../definitions/tables/AudioCueTable';

import { STAGE_DEFINITIONS, StageDefinitionTable } from '../definitions/tables/StageDefinitionTable';
import { BlockDefinitionTable } from '../definitions/tables/BlockDefinitionTable';
import { ItemDefinitionTable } from '../definitions/tables/ItemDefinitionTable';
import { GameplayConfigTable } from '../definitions/tables/GameplayConfigTable';
import type { DevContext } from './dev/DevContext';
import type { CollisionLogEntry } from './dev/CollisionLog';

/**
 * createAppContext 옵션.
 *
 * saveRepository: 저장소 구현체. 미제공 시 InMemorySaveRepository 사용.
 * audioPlayer: 오디오 플레이어 구현체. 미제공 시 NoopAudioPlayer 사용.
 * devContext: Dev 관측 도구 묶음. 미제공 시 dev hooks 완전 스킵 (production 오버헤드 0).
 */
export type AppContextOptions = {
  saveRepository?: ISaveRepository;
  audioPlayer?: IAudioPlayer;
  devContext?: DevContext;
};

/**
 * AppContext: 모든 의존성의 조립 지점.
 *
 * 공개 API:
 * - tick(input, dt): 단일 틱 엔트리. flowController.handleInput 후,
 *   flowState === 'inGame' 이면 gameplayController.tick 실행 (architecture §17).
 * - getFlowState(): 현재 FlowState 읽기 전용 조회.
 * - getGameplayState(): 현재 GameplayRuntimeState 읽기 전용 조회.
 * - getScreenState(): 현재 ScreenState 읽기 전용 조회. GameScene 에서 렌더링에 사용.
 * - handlePresentationEvent: Presentation 이벤트를 FlowController 에 전달.
 * - setAudioPlayer: AudioPlayer를 교체한다. GameScene.create 후 PhaserAudioPlayer 주입에 사용.
 *
 * 이벤트 배선:
 * - gameplayController 이벤트 → flowController.handleGameplayEvent + visualEffectController.handleGameplayEvent + audioPlayer
 * - flowController 이벤트:
 *   - EnteredRoundIntro + from === 'title'  → lifecycleHandler.initializeStage (새 게임) + UiConfirm SFX
 *   - EnteredRoundIntro + from === 'inGame' → lifecycleHandler.resetForRetry (재시도) + jingle
 *   - EnteredTitle + from === 'gameOver'    → UiConfirm SFX
 *   - EnteredGameOver → saveRepository.save 호출 (highScore 갱신, fire-and-forget) + jingle
 *   - EnteredTitle → BGM
 * - VisualEffectController 가 LifeLostPresentationFinished 발행 → handlePresentationEvent 경유
 *
 * 틱 순서 (architecture §17):
 * 1. flowController.handleInput
 * 2. flowState === 'inGame' 이면 gameplayController.tick
 * 3. screenDirector.update(flowState, deltaMs * 1000, emitPresentationEvent)
 *    └── 내부에서 visualEffectController.update 호출
 */
export type AppContext = {
  tick(input: InputSnapshot, dt: number): void;
  getFlowState(): Readonly<GameFlowState>;
  getGameplayState(): Readonly<GameplayRuntimeState>;
  getScreenState(): Readonly<ScreenState>;
  handlePresentationEvent(event: PresentationEvent): void;
  getVisualEffectController(): import('../presentation/controller/VisualEffectController').VisualEffectController;
  /** AudioPlayer를 교체한다. GameScene.create 후 PhaserAudioPlayer 주입에 사용. */
  setAudioPlayer(player: IAudioPlayer): void;
  /** 테스트 전용: GameplayController 상태를 직접 교체한다. 프로덕션 코드에서 호출 금지. */
  _setGameplayState(state: GameplayRuntimeState): void;
};

/**
 * AppContext를 비동기로 생성한다.
 *
 * async 이유:
 * - 생성 시점에 saveRepository.load()를 await하여 초기 highScore를 로드.
 * - Title 화면 진입 전에 이미 highScore가 세팅된 상태를 보장 (UX: 0→실제값 깜빡임 없음).
 * - main.ts에서 Phaser 시작 전에 1회 await하면 된다.
 */
export async function createAppContext(options?: AppContextOptions): Promise<AppContext> {
  const saveRepository: ISaveRepository = options?.saveRepository ?? new InMemorySaveRepository();
  const devContext: DevContext | undefined = options?.devContext;

  // AudioCueResolver는 항상 AudioCueTable 기반으로 초기화
  const audioCueResolver = new AudioCueResolver(AudioCueTable);
  // audioPlayer는 교체 가능 — 기본값은 NoopAudioPlayer (Phaser 없는 환경 대응)
  let audioPlayer: IAudioPlayer = options?.audioPlayer ?? new NoopAudioPlayer();

  const config = GameplayConfigTable;

  const lifecycleHandler = new GameplayLifecycleHandler(BlockDefinitionTable);

  // 초기 highScore 로드: 생성 시점에 await하여 Title 화면 진입 전 세팅 보장
  const initialSaveData = await saveRepository.load();
  const initialHighScore = initialSaveData.highScore;

  // GameplayController 는 초기 상태가 필요하다.
  // Title 진입 시점에는 아직 게임이 시작되지 않았으므로,
  // 빈 placeholder 상태로 초기화하고 EnteredRoundIntro(from='introStory') 때 교체한다.
  const baseState = lifecycleHandler.initializeStage(STAGE_DEFINITIONS[0]!, config, config.initialLives);
  const placeholderState: GameplayRuntimeState = {
    ...baseState,
    session: { ...baseState.session, highScore: initialHighScore },
  };

  const gameplayController = new GameplayController(placeholderState, {
    blockDefinitions: BlockDefinitionTable,
    itemDefinitions: ItemDefinitionTable,
    config,
  });

  // VisualEffectController: Gameplay 이벤트를 받아 시각 연출 타이머 관리
  const visualEffectController = new VisualEffectController(config);

  // ScreenDirector: VisualEffectController 를 내부에서 update 호출
  const screenDirector = new ScreenDirector(config.roundIntroDurationMs, visualEffectController);

  // FlowController: Gameplay 이벤트를 받아 Flow 전이를 처리한다.
  // totalStageCount: StageDefinitionTable 배열 길이 기준 (mvp2 §11-3)
  const flowController = new GameFlowController((flowEvent: FlowEvent) => {
    onFlowEvent(flowEvent);
  }, { totalStageCount: StageDefinitionTable.length });

  // Flow 이벤트 핸들러 (forward declaration 패턴)
  function onFlowEvent(event: FlowEvent): void {
    // Audio 라우팅: Flow 이벤트 → AudioCueResolver → AudioPlayer
    // UiConfirm 특수 처리:
    //   - EnteredRoundIntro(from='introStory'): 게임 시작 버튼 확인음 (Title→IntroStory→RoundIntro 흐름)
    //   - EnteredTitle(from='gameOver' | 'gameClear'): 결과 화면에서 타이틀 복귀 확인음
    if (event.type === 'EnteredRoundIntro' && event.from === 'introStory') {
      // jingle(round_start) + UiConfirm 모두 재생
      const roundCues = audioCueResolver.resolveCueIds('EnteredRoundIntro');
      for (const cue of roundCues) {
        audioPlayer.play(cue);
      }
      const confirmCues = audioCueResolver.resolveCueIds('UiConfirm');
      for (const cue of confirmCues) {
        audioPlayer.play(cue);
      }
    } else if (
      event.type === 'EnteredTitle' &&
      (event.from === 'gameOver' || event.from === 'gameClear')
    ) {
      // UiConfirm SFX
      const confirmCues = audioCueResolver.resolveCueIds('UiConfirm');
      for (const cue of confirmCues) {
        audioPlayer.play(cue);
      }
      // 타이틀 BGM 재개
      const titleCues = audioCueResolver.resolveCueIds('EnteredTitle');
      for (const cue of titleCues) {
        audioPlayer.play(cue);
      }
    } else {
      // 그 외 Flow 이벤트는 eventType 기반 직접 매핑
      const cues = audioCueResolver.resolveCueIds(event.type);
      for (const cue of cues) {
        audioPlayer.play(cue);
      }
    }

    if (event.type === 'EnteredRoundIntro') {
      if (event.from === 'introStory') {
        // 인트로 종료 후 첫 스테이지 시작: Stage 0(index) 완전 초기화, 현재 highScore 유지
        const currentHighScore = gameplayController.getState().session.highScore;
        const stage0 = STAGE_DEFINITIONS[0]!;
        const newState = lifecycleHandler.initializeStage(stage0, config, config.initialLives);
        gameplayController.setState({
          ...newState,
          session: { ...newState.session, highScore: currentHighScore, currentStageIndex: 0 },
        });
      } else if (event.from === 'inGame') {
        // inGame → RoundIntro: StageCleared(다음 스테이지) vs LifeLost(재시도) 구분
        // Flow 가 이미 currentStageIndex 를 증가시킨 상태이므로 비교 가능
        const currentGameplayState = gameplayController.getState() as GameplayRuntimeState;
        const flowStageIndex = flowController.getState().currentStageIndex;
        const gameplayStageIndex = currentGameplayState.session.currentStageIndex;

        if (flowStageIndex !== gameplayStageIndex) {
          // StageCleared 경로: 다음 스테이지 로드 (score/lives 유지, 블록 재구성)
          const nextStage = STAGE_DEFINITIONS[flowStageIndex];
          if (nextStage === undefined) {
            // 스테이지 정의 없음 — 방어적 처리 (GameClear 가 이미 처리했어야 하는 케이스)
            return;
          }
          const nextState = lifecycleHandler.loadNextStage(currentGameplayState, nextStage, config);
          gameplayController.setState({
            ...nextState,
            session: { ...nextState.session, currentStageIndex: flowStageIndex },
          });
        } else {
          // LifeLost 경로: 같은 스테이지 재시도 (블록/점수/라이프 유지, 위치만 리셋)
          const currentStage = STAGE_DEFINITIONS[gameplayStageIndex] ?? STAGE_DEFINITIONS[0]!;
          const resetState = lifecycleHandler.resetForRetry(
            currentGameplayState,
            currentStage,
            config,
          );
          gameplayController.setState(resetState);
        }
      }
    } else if (event.type === 'EnteredGameOver' || event.type === 'EnteredGameClear') {
      // 저장 시점: GameOver / GameClear 진입 시 highScore 갱신 후 저장 (fire-and-forget)
      const session = gameplayController.getState().session;
      const newHighScore = Math.max(session.highScore, session.score);
      if (newHighScore > session.highScore) {
        // highScore 갱신
        const updatedState = gameplayController.getState() as GameplayRuntimeState;
        gameplayController.setState({
          ...updatedState,
          session: { ...updatedState.session, highScore: newHighScore },
        });
      }
      saveRepository.save({ highScore: newHighScore }).catch((err: unknown) => {
        console.warn('[AppContext] saveRepository.save 실패:', err);
      });
    }
  }

  // Presentation 이벤트 발행 콜백.
  // VisualEffectController 가 타이머 완료 시 이 콜백을 통해 이벤트를 발행한다.
  function emitPresentationEvent(event: PresentationEvent): void {
    handlePresentationEvent(event);
  }

  /** 틱 번호 카운터 (dev CollisionLog에서 tick 필드로 사용) */
  let currentTick = 0;

  function tick(input: InputSnapshot, dt: number): void {
    // Flow 입력 처리 (Title, GameOver 등 비인게임 상태에서의 입력)
    flowController.handleInput(input);

    // InGame 상태일 때만 Gameplay 틱 실행 (architecture §17)
    if (flowController.getState().kind === 'inGame') {
      const gameplayEvents: GameplayEvent[] = gameplayController.tick(input, dt);
      for (const event of gameplayEvents) {
        // Flow 와 VisualEffectController 모두에 이벤트 전달
        flowController.handleGameplayEvent(event);
        visualEffectController.handleGameplayEvent(event);
        // Audio 라우팅: Gameplay 이벤트 → AudioCueResolver → AudioPlayer
        const audioCues = audioCueResolver.resolveCueIds(event.type);
        for (const cue of audioCues) {
          audioPlayer.play(cue);
        }

        // Dev: 충돌 이벤트를 CollisionLog에 기록
        // devContext가 undefined이거나 isEnabled === false이면 완전 스킵
        if (devContext?.isEnabled) {
          const state = gameplayController.getState();
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
            // 공 바닥 통과 → floor
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

      // Dev: 틱 후 invariant 검증 + ball trail + replay 녹화
      if (devContext?.isEnabled) {
        const state = gameplayController.getState();

        // Invariant 검증 — 위반 시 console.warn
        const violations = devContext.invariantChecker.check(state);
        for (const v of violations) {
          console.warn(`[InvariantChecker] ${v.type}: ${v.message}`, v.context);
        }

        // Ball trail: 활성 공의 첫 번째 좌표 기록
        const activeBall = state.balls.find((b) => b.isActive);
        if (activeBall !== undefined) {
          devContext.ballTrail.push(activeBall.x, activeBall.y);
        }

        // Replay 녹화
        devContext.replayRecorder.record(input, dt);
      }
    }

    currentTick++;

    // ScreenDirector 갱신 — dt는 초 단위이므로 ms로 변환
    const deltaMs = dt * 1000;
    screenDirector.update(flowController.getState(), deltaMs, emitPresentationEvent);
  }

  function getFlowState(): Readonly<GameFlowState> {
    return flowController.getState();
  }

  function getGameplayState(): Readonly<GameplayRuntimeState> {
    return gameplayController.getState() as Readonly<GameplayRuntimeState>;
  }

  function getScreenState(): Readonly<ScreenState> {
    return screenDirector.getScreenState();
  }

  function handlePresentationEvent(event: PresentationEvent): void {
    flowController.handlePresentationEvent(event);
  }

  function getVisualEffectController(): VisualEffectController {
    return visualEffectController;
  }

  function setAudioPlayer(player: IAudioPlayer): void {
    audioPlayer = player;
  }

  function _setGameplayState(state: GameplayRuntimeState): void {
    gameplayController.setState(state);
  }

  return {
    tick,
    getFlowState,
    getGameplayState,
    getScreenState,
    handlePresentationEvent,
    getVisualEffectController,
    setAudioPlayer,
    _setGameplayState,
  };
}
