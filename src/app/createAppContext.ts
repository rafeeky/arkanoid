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
import { IntroSequenceTable } from '../definitions/tables/IntroSequenceTable';
import type { DevContext } from './dev/DevContext';
import { FlowEventRouter } from './FlowEventRouter';

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
 * 이벤트 배선 (FlowEventRouter 위임):
 * - gameplayController 이벤트 → FlowEventRouter.onGameplayEvent
 *   └── flowController.handleGameplayEvent + visualEffectController.handleGameplayEvent + audioPlayer
 * - flowController 이벤트 → FlowEventRouter.onFlowEvent
 *   └── audio 라우팅 + save 트리거 + stage 로드 결정
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
  /** Dev 전용: 진행 중인 intro 를 즉시 스킵한다. IntroSequenceFinished 가 발행되어 Flow 가 RoundIntro 로 전이한다. */
  skipIntroSequence(): void;
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
  // IntroSequenceTable 주입: Intro 페이지 타이머 진행에 사용
  const visualEffectController = new VisualEffectController(config, IntroSequenceTable);

  // ScreenDirector: VisualEffectController 를 내부에서 update 호출
  const screenDirector = new ScreenDirector(config.roundIntroDurationMs, visualEffectController);

  // FlowController: Gameplay 이벤트를 받아 Flow 전이를 처리한다.
  // totalStageCount: StageDefinitionTable 배열 길이 기준 (mvp2 §11-3)
  const flowController = new GameFlowController((flowEvent: FlowEvent) => {
    flowEventRouter.onFlowEvent(flowEvent);
  }, { totalStageCount: StageDefinitionTable.length });

  // FlowEventRouter: Flow/Gameplay 이벤트 라우팅 책임을 단일 클래스로 분리
  // audioPlayer는 교체 가능이므로 getter 콜백으로 전달
  const flowEventRouter = new FlowEventRouter({
    getAudioPlayer: () => audioPlayer,
    audioCueResolver,
    gameplayController,
    flowController,
    lifecycleHandler,
    saveRepository,
    config,
    stageDefinitions: STAGE_DEFINITIONS,
    ...(devContext !== undefined ? { devContext } : {}),
  });

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
        // FlowEventRouter 에 위임: Flow 중계 + Audio + Dev 기록
        flowEventRouter.onGameplayEvent(event, currentTick);
        // VisualEffectController 는 createAppContext 에서 직접 연결 유지
        // (Presentation 계층 의존 — FlowEventRouter 는 gameplay → presentation import 불가)
        visualEffectController.handleGameplayEvent(event);
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

  function skipIntroSequence(): void {
    visualEffectController.skipIntroSequence(handlePresentationEvent);
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
    skipIntroSequence,
  };
}
