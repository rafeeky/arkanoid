import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowEventRouter } from './FlowEventRouter';
import { AudioCueResolver } from '../audio/AudioCueResolver';
import { AudioCueTable } from '../definitions/tables/AudioCueTable';
import type { IAudioPlayer } from '../audio/IAudioPlayer';
import type { AudioCueEntry } from '../definitions/types/AudioCueEntry';
import type { FlowEvent } from '../flow/events/flowEvents';
import type { GameplayEvent } from '../gameplay/events/gameplayEvents';
import type { ISaveRepository } from '../persistence/ISaveRepository';
import type { GameplayRuntimeState } from '../gameplay/state/GameplayRuntimeState';
import type { GameplayConfig } from '../definitions/types/GameplayConfig';
import type { StageDefinition } from '../definitions/types/StageDefinition';
import type { SaveData } from '../persistence/SaveData';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockAudioPlayer(): IAudioPlayer & { calls: AudioCueEntry[] } {
  const calls: AudioCueEntry[] = [];
  return {
    calls,
    play(cue: AudioCueEntry): void {
      calls.push(cue);
    },
    stopAll(): void {
      // noop
    },
  };
}

function createMockSaveRepository(
  initialHighScore: number = 0,
): ISaveRepository & { savedData: SaveData | undefined } {
  let savedData: SaveData | undefined;
  return {
    get savedData() {
      return savedData;
    },
    async load(): Promise<SaveData> {
      return { highScore: initialHighScore };
    },
    async save(data: SaveData): Promise<void> {
      savedData = data;
    },
  };
}

/** GameplayController 최소 mock */
function createMockGameplayController(initialState: GameplayRuntimeState) {
  let state = initialState;
  return {
    getState: vi.fn(() => state),
    setState: vi.fn((s: GameplayRuntimeState) => { state = s; }),
  };
}

/** GameFlowController 최소 mock */
function createMockFlowController(stageIndex: number = 0) {
  return {
    getState: vi.fn(() => ({ kind: 'inGame' as const, currentStageIndex: stageIndex })),
    handleGameplayEvent: vi.fn(),
  };
}

/** GameplayLifecycleHandler 최소 mock */
function createMockLifecycleHandler() {
  return {
    initializeStage: vi.fn((stage: StageDefinition, config: GameplayConfig, lives: number): GameplayRuntimeState => {
      return makeMinimalState({ currentStageIndex: 0, lives });
    }),
    resetForRetry: vi.fn((current: GameplayRuntimeState): GameplayRuntimeState => current),
    loadNextStage: vi.fn((current: GameplayRuntimeState, _nextStage: StageDefinition): GameplayRuntimeState => current),
  };
}

/** 최소 GameplayRuntimeState 생성 헬퍼 */
function makeMinimalState(overrides: {
  currentStageIndex?: number;
  score?: number;
  lives?: number;
  highScore?: number;
} = {}): GameplayRuntimeState {
  return {
    session: {
      currentStageIndex: overrides.currentStageIndex ?? 0,
      score: overrides.score ?? 0,
      lives: overrides.lives ?? 3,
      highScore: overrides.highScore ?? 0,
    },
    bar: {
      x: 480,
      y: 750,
      width: 120,
      moveSpeed: 300,
      activeEffect: 'none',
    },
    balls: [{ id: 'b0', x: 480, y: 734, vx: 0, vy: 0, isActive: false }],
    blocks: [],
    itemDrops: [],
    isStageCleared: false,
  };
}

const minimalConfig: GameplayConfig = {
  initialLives: 3,
  baseBarWidth: 120,
  barMoveSpeed: 300,
  ballInitialSpeed: 300,
  ballInitialAngleDeg: -60,
  roundIntroDurationMs: 2000,
  blockHitFlashDurationMs: 200,
  barBreakDurationMs: 700,
  expandMultiplier: 1.5,
};

const minimalStageDefinition: StageDefinition = {
  stageId: 'stage_0',
  displayName: 'Stage 1',
  backgroundId: 'bg_stage0',
  barSpawnX: 480,
  barSpawnY: 750,
  ballSpawnX: 480,
  ballSpawnY: 734,
  ballInitialSpeed: 300,
  ballInitialAngleDeg: -60,
  blocks: [],
};

// ---------------------------------------------------------------------------
// Factory: FlowEventRouter with mocks
// ---------------------------------------------------------------------------

function makeRouter(overrides: {
  audioPlayer?: IAudioPlayer & { calls: AudioCueEntry[] };
  saveRepository?: ISaveRepository & { savedData: SaveData | undefined };
  initialState?: GameplayRuntimeState;
  flowStageIndex?: number;
  stageDefinitions?: readonly StageDefinition[];
}) {
  const audioPlayer = overrides.audioPlayer ?? createMockAudioPlayer();
  const saveRepository = overrides.saveRepository ?? createMockSaveRepository();
  const initialState = overrides.initialState ?? makeMinimalState();
  const gameplayController = createMockGameplayController(initialState);
  const flowController = createMockFlowController(overrides.flowStageIndex ?? 0);
  const lifecycleHandler = createMockLifecycleHandler();
  const audioCueResolver = new AudioCueResolver(AudioCueTable);
  const stageDefinitions = overrides.stageDefinitions ?? [minimalStageDefinition];

  const router = new FlowEventRouter({
    getAudioPlayer: () => audioPlayer,
    audioCueResolver,
    gameplayController: gameplayController as unknown as import('../gameplay/controller/GameplayController').GameplayController,
    flowController: flowController as unknown as import('../flow/controller/GameFlowController').GameFlowController,
    lifecycleHandler: lifecycleHandler as unknown as import('../gameplay/controller/GameplayLifecycleHandler').GameplayLifecycleHandler,
    saveRepository,
    config: minimalConfig,
    stageDefinitions,
  });

  return { router, audioPlayer, saveRepository, gameplayController, flowController, lifecycleHandler };
}

// ---------------------------------------------------------------------------
// Tests: onFlowEvent — audio routing
// ---------------------------------------------------------------------------

describe('FlowEventRouter.onFlowEvent — audio routing', () => {
  it('EnteredTitle (from=gameOver) 시 sfx_ui_confirm + bgm_title 재생', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: FlowEvent = { type: 'EnteredTitle', from: 'gameOver' };
    router.onFlowEvent(event);
    const resourceIds = audioPlayer.calls.map((c) => c.resourceId);
    expect(resourceIds).toContain('sfx_ui_confirm');
    expect(resourceIds).toContain('bgm_title');
  });

  it('EnteredTitle (from=gameClear) 시 sfx_ui_confirm + bgm_title 재생', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: FlowEvent = { type: 'EnteredTitle', from: 'gameClear' };
    router.onFlowEvent(event);
    const resourceIds = audioPlayer.calls.map((c) => c.resourceId);
    expect(resourceIds).toContain('sfx_ui_confirm');
    expect(resourceIds).toContain('bgm_title');
  });

  it('EnteredTitle (from=title) 시 bgm_title만 재생 (UiConfirm 없음)', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: FlowEvent = { type: 'EnteredTitle', from: 'title' };
    router.onFlowEvent(event);
    const resourceIds = audioPlayer.calls.map((c) => c.resourceId);
    expect(resourceIds).toContain('bgm_title');
    expect(resourceIds).not.toContain('sfx_ui_confirm');
  });

  it('EnteredRoundIntro (from=introStory) 시 jingle_round_start + sfx_ui_confirm 재생', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: FlowEvent = { type: 'EnteredRoundIntro', from: 'introStory' };
    router.onFlowEvent(event);
    const resourceIds = audioPlayer.calls.map((c) => c.resourceId);
    expect(resourceIds).toContain('jingle_round_start');
    expect(resourceIds).toContain('sfx_ui_confirm');
  });

  it('EnteredRoundIntro (from=inGame) 시 jingle_round_start만 재생 (UiConfirm 없음)', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: FlowEvent = { type: 'EnteredRoundIntro', from: 'inGame' };
    router.onFlowEvent(event);
    const resourceIds = audioPlayer.calls.map((c) => c.resourceId);
    expect(resourceIds).toContain('jingle_round_start');
    expect(resourceIds).not.toContain('sfx_ui_confirm');
  });

  it('EnteredGameOver 시 jingle_gameover 재생', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: FlowEvent = { type: 'EnteredGameOver', from: 'inGame' };
    router.onFlowEvent(event);
    const resourceIds = audioPlayer.calls.map((c) => c.resourceId);
    expect(resourceIds).toContain('jingle_gameover');
  });

  it('EnteredGameClear 시 jingle_gameclear 재생', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: FlowEvent = { type: 'EnteredGameClear', from: 'inGame' };
    router.onFlowEvent(event);
    const resourceIds = audioPlayer.calls.map((c) => c.resourceId);
    expect(resourceIds).toContain('jingle_gameclear');
  });
});

// ---------------------------------------------------------------------------
// Tests: onFlowEvent — save triggers
// ---------------------------------------------------------------------------

describe('FlowEventRouter.onFlowEvent — save triggers', () => {
  it('EnteredGameOver 진입 시 saveRepository.save 호출됨', async () => {
    const saveRepository = createMockSaveRepository(0);
    const saveSpy = vi.spyOn(saveRepository, 'save');
    const { router } = makeRouter({ saveRepository, initialState: makeMinimalState({ score: 500, highScore: 0 }) });

    const event: FlowEvent = { type: 'EnteredGameOver', from: 'inGame' };
    router.onFlowEvent(event);

    // fire-and-forget이므로 microtask flush
    await Promise.resolve();

    expect(saveSpy).toHaveBeenCalled();
  });

  it('EnteredGameClear 진입 시 saveRepository.save 호출됨', async () => {
    const saveRepository = createMockSaveRepository(0);
    const saveSpy = vi.spyOn(saveRepository, 'save');
    const { router } = makeRouter({ saveRepository, initialState: makeMinimalState({ score: 1000, highScore: 0 }) });

    const event: FlowEvent = { type: 'EnteredGameClear', from: 'inGame' };
    router.onFlowEvent(event);

    await Promise.resolve();

    expect(saveSpy).toHaveBeenCalled();
  });

  it('score > highScore 이면 새 highScore로 save 호출됨', async () => {
    const saveRepository = createMockSaveRepository(100);
    const { router } = makeRouter({
      saveRepository,
      initialState: makeMinimalState({ score: 500, highScore: 100 }),
    });

    const event: FlowEvent = { type: 'EnteredGameOver', from: 'inGame' };
    router.onFlowEvent(event);

    await Promise.resolve();
    await Promise.resolve();

    expect(saveRepository.savedData?.highScore).toBe(500);
  });

  it('score <= highScore 이면 기존 highScore 유지', async () => {
    const saveRepository = createMockSaveRepository(9999);
    const { router } = makeRouter({
      saveRepository,
      initialState: makeMinimalState({ score: 100, highScore: 9999 }),
    });

    const event: FlowEvent = { type: 'EnteredGameOver', from: 'inGame' };
    router.onFlowEvent(event);

    await Promise.resolve();
    await Promise.resolve();

    expect(saveRepository.savedData?.highScore).toBe(9999);
  });
});

// ---------------------------------------------------------------------------
// Tests: onFlowEvent — stage load decisions
// ---------------------------------------------------------------------------

describe('FlowEventRouter.onFlowEvent — stage load decisions', () => {
  it('EnteredRoundIntro (from=introStory) 시 lifecycleHandler.initializeStage 호출됨', () => {
    const { router, lifecycleHandler } = makeRouter({
      stageDefinitions: [minimalStageDefinition],
    });
    const event: FlowEvent = { type: 'EnteredRoundIntro', from: 'introStory' };
    router.onFlowEvent(event);
    expect(lifecycleHandler.initializeStage).toHaveBeenCalledOnce();
  });

  it('EnteredRoundIntro (from=inGame) + flowStageIndex !== gameplayStageIndex → loadNextStage 호출', () => {
    // flowStageIndex=1, gameplayStageIndex=0 → StageCleared 경로
    const stage0 = { ...minimalStageDefinition, stageId: 'stage_0' };
    const stage1 = { ...minimalStageDefinition, stageId: 'stage_1' };
    const { router, lifecycleHandler } = makeRouter({
      initialState: makeMinimalState({ currentStageIndex: 0 }),
      flowStageIndex: 1,
      stageDefinitions: [stage0, stage1],
    });
    const event: FlowEvent = { type: 'EnteredRoundIntro', from: 'inGame' };
    router.onFlowEvent(event);
    expect(lifecycleHandler.loadNextStage).toHaveBeenCalledOnce();
  });

  it('EnteredRoundIntro (from=inGame) + flowStageIndex === gameplayStageIndex → resetForRetry 호출', () => {
    // flowStageIndex=0, gameplayStageIndex=0 → LifeLost 경로
    const { router, lifecycleHandler } = makeRouter({
      initialState: makeMinimalState({ currentStageIndex: 0 }),
      flowStageIndex: 0,
      stageDefinitions: [minimalStageDefinition],
    });
    const event: FlowEvent = { type: 'EnteredRoundIntro', from: 'inGame' };
    router.onFlowEvent(event);
    expect(lifecycleHandler.resetForRetry).toHaveBeenCalledOnce();
  });

  it('EnteredRoundIntro (from=inGame) + 다음 스테이지 정의 없음 → 조용히 무시 (방어 경로)', () => {
    // flowStageIndex=2이지만 stageDefinitions에 index=2 없음
    const { router, lifecycleHandler } = makeRouter({
      initialState: makeMinimalState({ currentStageIndex: 0 }),
      flowStageIndex: 2,
      stageDefinitions: [minimalStageDefinition],
    });
    const event: FlowEvent = { type: 'EnteredRoundIntro', from: 'inGame' };
    // 예외 없이 실행되어야 함
    expect(() => router.onFlowEvent(event)).not.toThrow();
    expect(lifecycleHandler.loadNextStage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: onGameplayEvent — audio routing + Flow relay
// ---------------------------------------------------------------------------

describe('FlowEventRouter.onGameplayEvent — audio routing', () => {
  it('BlockHit 이벤트 시 sfx_block_hit 재생', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: GameplayEvent = { type: 'BlockHit', blockId: 'b1', remainingHits: 1 };
    router.onGameplayEvent(event, 0);
    expect(audioPlayer.calls.some((c) => c.resourceId === 'sfx_block_hit')).toBe(true);
  });

  it('BlockDestroyed 이벤트 시 sfx_block_destroyed 재생', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: GameplayEvent = { type: 'BlockDestroyed', blockId: 'b2', scoreDelta: 100 };
    router.onGameplayEvent(event, 0);
    expect(audioPlayer.calls.some((c) => c.resourceId === 'sfx_block_destroyed')).toBe(true);
  });

  it('LifeLost 이벤트 시 sfx_life_lost 재생', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: GameplayEvent = { type: 'LifeLost', remainingLives: 2 };
    router.onGameplayEvent(event, 0);
    expect(audioPlayer.calls.some((c) => c.resourceId === 'sfx_life_lost')).toBe(true);
  });

  it('ItemCollected 이벤트 시 sfx_item_collected 재생', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: GameplayEvent = {
      type: 'ItemCollected',
      itemType: 'expand',
      replacedEffect: 'none',
      newEffect: 'expand',
    };
    router.onGameplayEvent(event, 0);
    expect(audioPlayer.calls.some((c) => c.resourceId === 'sfx_item_collected')).toBe(true);
  });

  it('BallLaunched 이벤트 시 audioPlayer 호출 0회 (AudioCueTable에 매핑 없음)', () => {
    const { router, audioPlayer } = makeRouter({});
    const event: GameplayEvent = { type: 'BallLaunched' };
    router.onGameplayEvent(event, 0);
    expect(audioPlayer.calls).toHaveLength(0);
  });
});

describe('FlowEventRouter.onGameplayEvent — Flow relay', () => {
  it('BlockHit 이벤트가 flowController.handleGameplayEvent로 전달됨', () => {
    const { router, flowController } = makeRouter({});
    const event: GameplayEvent = { type: 'BlockHit', blockId: 'b1', remainingHits: 1 };
    router.onGameplayEvent(event, 0);
    expect(flowController.handleGameplayEvent).toHaveBeenCalledWith(event);
  });

  it('LifeLost 이벤트가 flowController.handleGameplayEvent로 전달됨', () => {
    const { router, flowController } = makeRouter({});
    const event: GameplayEvent = { type: 'LifeLost', remainingLives: 2 };
    router.onGameplayEvent(event, 0);
    expect(flowController.handleGameplayEvent).toHaveBeenCalledWith(event);
  });

  it('StageCleared 이벤트가 flowController.handleGameplayEvent로 전달됨', () => {
    const { router, flowController } = makeRouter({});
    const event: GameplayEvent = { type: 'StageCleared' };
    router.onGameplayEvent(event, 0);
    expect(flowController.handleGameplayEvent).toHaveBeenCalledWith(event);
  });
});

// ---------------------------------------------------------------------------
// Tests: onGameplayEvent — Dev collision logging
// ---------------------------------------------------------------------------

describe('FlowEventRouter.onGameplayEvent — Dev collision logging', () => {
  it('devContext 없으면 CollisionLog에 기록 안 됨 (오류 없이 통과)', () => {
    const { router } = makeRouter({});
    // devContext 없는 기본 router — 오류 없이 실행되어야 함
    const event: GameplayEvent = { type: 'BlockHit', blockId: 'b1', remainingHits: 1 };
    expect(() => router.onGameplayEvent(event, 5)).not.toThrow();
  });

  it('devContext.isEnabled=true, BlockHit → collisionLog.push 호출', () => {
    const collisionLog = { push: vi.fn() };
    const devContext = {
      isEnabled: true,
      invariantChecker: { check: vi.fn(() => []) },
      replayRecorder: { record: vi.fn() },
      collisionLog,
      ballTrail: { push: vi.fn() },
    };
    const { router } = makeRouter({});
    // devContext를 직접 주입하려면 makeRouter 대신 직접 생성
    const audioPlayer = createMockAudioPlayer();
    const saveRepository = createMockSaveRepository();
    const initialState = makeMinimalState();
    const gameplayController = createMockGameplayController(initialState);
    const flowController = createMockFlowController(0);
    const lifecycleHandler = createMockLifecycleHandler();
    const audioCueResolver = new AudioCueResolver(AudioCueTable);

    const routerWithDev = new FlowEventRouter({
      getAudioPlayer: () => audioPlayer,
      audioCueResolver,
      gameplayController: gameplayController as unknown as import('../gameplay/controller/GameplayController').GameplayController,
      flowController: flowController as unknown as import('../flow/controller/GameFlowController').GameFlowController,
      lifecycleHandler: lifecycleHandler as unknown as import('../gameplay/controller/GameplayLifecycleHandler').GameplayLifecycleHandler,
      saveRepository,
      config: minimalConfig,
      stageDefinitions: [minimalStageDefinition],
      devContext: devContext as unknown as import('./dev/DevContext').DevContext,
    });

    const event: GameplayEvent = { type: 'BlockHit', blockId: 'b1', remainingHits: 1 };
    routerWithDev.onGameplayEvent(event, 42);

    expect(collisionLog.push).toHaveBeenCalledOnce();
    const entry = collisionLog.push.mock.calls[0]?.[0];
    expect(entry?.tick).toBe(42);
    expect(entry?.target.kind).toBe('block');
    expect(entry?.target.id).toBe('b1');
  });

  it('devContext.isEnabled=true, LifeLost → collisionLog에 floor 기록', () => {
    const collisionLog = { push: vi.fn() };
    const devContext = {
      isEnabled: true,
      invariantChecker: { check: vi.fn(() => []) },
      replayRecorder: { record: vi.fn() },
      collisionLog,
      ballTrail: { push: vi.fn() },
    };
    const audioPlayer = createMockAudioPlayer();
    const saveRepository = createMockSaveRepository();
    const gameplayController = createMockGameplayController(makeMinimalState());
    const flowController = createMockFlowController(0);
    const lifecycleHandler = createMockLifecycleHandler();
    const audioCueResolver = new AudioCueResolver(AudioCueTable);

    const routerWithDev = new FlowEventRouter({
      getAudioPlayer: () => audioPlayer,
      audioCueResolver,
      gameplayController: gameplayController as unknown as import('../gameplay/controller/GameplayController').GameplayController,
      flowController: flowController as unknown as import('../flow/controller/GameFlowController').GameFlowController,
      lifecycleHandler: lifecycleHandler as unknown as import('../gameplay/controller/GameplayLifecycleHandler').GameplayLifecycleHandler,
      saveRepository,
      config: minimalConfig,
      stageDefinitions: [minimalStageDefinition],
      devContext: devContext as unknown as import('./dev/DevContext').DevContext,
    });

    const event: GameplayEvent = { type: 'LifeLost', remainingLives: 2 };
    routerWithDev.onGameplayEvent(event, 10);

    expect(collisionLog.push).toHaveBeenCalledOnce();
    const entry = collisionLog.push.mock.calls[0]?.[0];
    expect(entry?.target.kind).toBe('floor');
  });

  it('devContext.isEnabled=false 이면 collisionLog.push 호출 안 됨', () => {
    const collisionLog = { push: vi.fn() };
    const devContext = {
      isEnabled: false,
      invariantChecker: { check: vi.fn(() => []) },
      replayRecorder: { record: vi.fn() },
      collisionLog,
      ballTrail: { push: vi.fn() },
    };
    const audioPlayer = createMockAudioPlayer();
    const saveRepository = createMockSaveRepository();
    const gameplayController = createMockGameplayController(makeMinimalState());
    const flowController = createMockFlowController(0);
    const lifecycleHandler = createMockLifecycleHandler();
    const audioCueResolver = new AudioCueResolver(AudioCueTable);

    const routerWithDev = new FlowEventRouter({
      getAudioPlayer: () => audioPlayer,
      audioCueResolver,
      gameplayController: gameplayController as unknown as import('../gameplay/controller/GameplayController').GameplayController,
      flowController: flowController as unknown as import('../flow/controller/GameFlowController').GameFlowController,
      lifecycleHandler: lifecycleHandler as unknown as import('../gameplay/controller/GameplayLifecycleHandler').GameplayLifecycleHandler,
      saveRepository,
      config: minimalConfig,
      stageDefinitions: [minimalStageDefinition],
      devContext: devContext as unknown as import('./dev/DevContext').DevContext,
    });

    const event: GameplayEvent = { type: 'BlockHit', blockId: 'b1', remainingHits: 1 };
    routerWithDev.onGameplayEvent(event, 0);

    expect(collisionLog.push).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: audioPlayer replacement (setAudioPlayer 패턴 대응)
// ---------------------------------------------------------------------------

describe('FlowEventRouter — audioPlayer 교체', () => {
  it('getAudioPlayer 콜백이 교체된 인스턴스를 반환하면 새 player에 라우팅됨', () => {
    const originalMock = createMockAudioPlayer();
    const newMock = createMockAudioPlayer();
    let currentPlayer: IAudioPlayer = originalMock;

    const saveRepository = createMockSaveRepository();
    const gameplayController = createMockGameplayController(makeMinimalState());
    const flowController = createMockFlowController(0);
    const lifecycleHandler = createMockLifecycleHandler();
    const audioCueResolver = new AudioCueResolver(AudioCueTable);

    const router = new FlowEventRouter({
      getAudioPlayer: () => currentPlayer,
      audioCueResolver,
      gameplayController: gameplayController as unknown as import('../gameplay/controller/GameplayController').GameplayController,
      flowController: flowController as unknown as import('../flow/controller/GameFlowController').GameFlowController,
      lifecycleHandler: lifecycleHandler as unknown as import('../gameplay/controller/GameplayLifecycleHandler').GameplayLifecycleHandler,
      saveRepository,
      config: minimalConfig,
      stageDefinitions: [minimalStageDefinition],
    });

    // 교체 전
    const event: GameplayEvent = { type: 'BlockHit', blockId: 'b1', remainingHits: 1 };
    router.onGameplayEvent(event, 0);
    expect(originalMock.calls.length).toBeGreaterThan(0);

    // 교체 후
    currentPlayer = newMock;
    originalMock.calls.length = 0;

    router.onGameplayEvent(event, 1);
    expect(newMock.calls.length).toBeGreaterThan(0);
    expect(originalMock.calls.length).toBe(0);
  });
});
