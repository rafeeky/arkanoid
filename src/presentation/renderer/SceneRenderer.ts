import type Phaser from 'phaser';
import type { GameFlowState } from '../../flow/state/GameFlowState';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';
import type { ScreenState } from '../state/ScreenState';
import type { UITextEntry } from '../../definitions/types/UITextEntry';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import type { IntroSequenceEntry } from '../../definitions/types/IntroSequenceEntry';
import type { VisualEffectController } from '../controller/VisualEffectController';

import { ScreenPresenter } from '../controller/ScreenPresenter';

/** 화면(currentScreen) → 배경 텍스처 키 매핑. inGame/roundIntro 는 별도 처리(playfieldBg). */
const BG_KEY_BY_SCREEN: Record<ScreenState['currentScreen'], string> = {
  title:      'bg_title',
  introStory: 'bg_title',
  roundIntro: 'bg_title', // unused — inGame/roundIntro 는 위에서 early-return
  inGame:     'bg_title', // unused
  gameOver:   'bg_gameover',
  gameClear:  'bg_gameclear',
};

import { HUDPresenter } from '../controller/HUDPresenter';
import { GameplayConfigTable } from '../../definitions/tables/GameplayConfigTable';
import { getMascotById } from '../../definitions/tables/MascotTable';

import {
  type TitleScreenObjects,
  type MascotCarouselHandlers,
  createTitleScreenObjects,
  renderTitleScreen,
  hideTitleScreen,
} from './renderTitleScreen';
import {
  type RoundIntroScreenObjects,
  createRoundIntroScreenObjects,
  renderRoundIntroScreen,
  hideRoundIntroScreen,
} from './renderRoundIntroScreen';
import {
  type InGameObjects,
  createInGameObjects,
  renderInGameScreen,
  hideInGameScreen,
} from './renderInGameScreen';
import {
  type GameOverScreenObjects,
  createGameOverScreenObjects,
  renderGameOverScreen,
  hideGameOverScreen,
} from './renderGameOverScreen';
import {
  type IntroStoryScreenObjects,
  createIntroStoryScreenObjects,
  renderIntroStoryScreen,
  hideIntroStoryScreen,
} from './renderIntroStoryScreen';
import {
  type GameClearScreenObjects,
  createGameClearScreenObjects,
  renderGameClearScreen,
  hideGameClearScreen,
} from './renderGameClearScreen';

/**
 * SceneRenderer — GameScene에서 인스턴스화되어 6개 화면 렌더링을 담당한다.
 *
 * create() 단계에서 모든 Phaser 오브젝트를 1회 생성하고,
 * render() 에서 매 프레임 visible/position/text만 갱신한다.
 *
 * Unity 매핑: ScreenViewRoot MonoBehaviour. 각 sub-renderer는 자식 MonoBehaviour로 분리된다.
 */
export class SceneRenderer {
  private readonly scene: Phaser.Scene;
  private readonly presenter: ScreenPresenter;
  private readonly hudPresenter: HUDPresenter;
  private readonly uiTexts: readonly UITextEntry[];
  private readonly blockDefinitions: Readonly<Record<string, BlockDefinition>>;
  private readonly spinnerDefinitions: Readonly<Record<string, SpinnerDefinition>>;
  private readonly introPages: readonly IntroSequenceEntry[];
  private readonly visualEffectController: VisualEffectController;
  private readonly roundIntroDurationMs: number;
  private readonly mascotHandlers: MascotCarouselHandlers;
  private readonly mascotStateProvider: () => {
    cursorIndex: number;
    gold: number;
    isUnlocked: (id: string) => boolean;
    selectedMascotId: string;
  };

  private titleObjects!: TitleScreenObjects;
  private roundIntroObjects!: RoundIntroScreenObjects;
  private inGameObjects!: InGameObjects;
  private gameOverObjects!: GameOverScreenObjects;
  private introStoryObjects!: IntroStoryScreenObjects;
  private gameClearObjects!: GameClearScreenObjects;
  /** 전 화면 공통 배경 이미지. 화면별로 텍스처 키만 교체. */
  private backgroundImage!: Phaser.GameObjects.Image;
  /** 스테이지(inGame/roundIntro) 한정 — playfield 영역(720×900) 검은 배경. */
  private playfieldBg!: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    uiTexts: readonly UITextEntry[],
    blockDefinitions: Readonly<Record<string, BlockDefinition>>,
    spinnerDefinitions: Readonly<Record<string, SpinnerDefinition>>,
    visualEffectController: VisualEffectController,
    roundIntroDurationMs: number = 1500,
    introPages: readonly IntroSequenceEntry[] = [],
    mascotHandlers: MascotCarouselHandlers = defaultMascotHandlers(),
    mascotStateProvider: () => { cursorIndex: number; gold: number; isUnlocked: (id: string) => boolean; selectedMascotId: string }
      = () => ({ cursorIndex: 0, gold: 0, isUnlocked: () => true, selectedMascotId: 'albatross' }),
  ) {
    this.scene = scene;
    this.uiTexts = uiTexts;
    this.blockDefinitions = blockDefinitions;
    this.spinnerDefinitions = spinnerDefinitions;
    this.visualEffectController = visualEffectController;
    this.roundIntroDurationMs = roundIntroDurationMs;
    this.introPages = introPages;
    this.presenter = new ScreenPresenter();
    this.hudPresenter = new HUDPresenter();
    this.mascotHandlers = mascotHandlers;
    this.mascotStateProvider = mascotStateProvider;
  }

  /**
   * create — Phaser.Scene.create() 에서 1회 호출. 모든 오브젝트를 미리 생성한다.
   */
  create(): void {
    // 화면 공통 배경.
    // 렌더링 계층 문제: UI 카메라가 main 카메라 *위에* 그려지므로 배경을 UI 카메라에 두면
    // 게임 오브젝트(블록/공/바/스토리)를 덮어버린다. 따라서 배경은 main 카메라에 둔다.
    // main 카메라는 playfield 중심(360, 360)에 centerOn, zoom 1.5.
    // 1080×1920 캔버스를 zoom 1.5 로 환산한 world 크기 = 720×1280.
    // 가로/세로 약간 여유(×1.2)를 두어 다른 종횡비 폰에서 letterbox 가 노출되지 않게 한다.
    const ZOOM = 1.5;
    const BG_BLEED = 1.2;
    // main 카메라 centerOn(PLAYFIELD_WIDTH/2, PLAYFIELD_HEIGHT/2) = (360, 450).
    // 이 지점이 캔버스 중심 (540, 960) 에 매핑되므로 배경도 같은 world 좌표에 배치.
    this.backgroundImage = this.scene.add
      .image(360, 450, 'bg_title')
      .setOrigin(0.5, 0.5)
      .setDisplaySize((1080 / ZOOM) * BG_BLEED, (1920 / ZOOM) * BG_BLEED)
      .setDepth(-100)
      .setName('__background__');

    // playfield 검은 배경 — 스테이지에서만 visible. depth -50 (배경 위, 게임 오브젝트 아래).
    // 위치 = playfield 중심 (360, 450) world coord, 사이즈 720×900.
    this.playfieldBg = this.scene.add
      .rectangle(360, 450, 720, 900, 0x000000)
      .setOrigin(0.5, 0.5)
      .setDepth(-50)
      .setVisible(false);

    this.titleObjects = createTitleScreenObjects(this.scene, this.mascotHandlers);
    this.roundIntroObjects = createRoundIntroScreenObjects(this.scene);
    this.inGameObjects = createInGameObjects(this.scene);
    this.gameOverObjects = createGameOverScreenObjects(this.scene);
    this.introStoryObjects = createIntroStoryScreenObjects(this.scene);
    this.gameClearObjects = createGameClearScreenObjects(this.scene);
  }

  /** 현재 화면에 맞춰 배경 텍스처 교체.
   * 스테이지(inGame/roundIntro) 에서는 배경 이미지를 숨기고 main 카메라의
   * 단색 하늘색이 노출 + playfield 영역에 검은 사각형(playfieldBg) 으로 덮음. */
  private updateBackground(
    screen: ScreenState['currentScreen'],
    stageIndex: number,
  ): void {
    if (screen === 'inGame' || screen === 'roundIntro') {
      void stageIndex;
      this.backgroundImage.setVisible(false);
      this.playfieldBg.setVisible(true);
      return;
    }
    this.playfieldBg.setVisible(false);
    // OCP: screen → bg key 테이블 매핑 (새 화면 추가 시 BG_KEY_BY_SCREEN 한 곳만 갱신).
    const key = BG_KEY_BY_SCREEN[screen] ?? 'bg_title';
    this.backgroundImage.setTexture(key).setVisible(true);
  }

  /**
   * render — 매 프레임 현재 화면에 맞는 sub-renderer를 호출한다.
   * 현재 화면만 visible로 두고 나머지는 hide한다.
   */
  render(
    flowState: Readonly<GameFlowState>,
    gameplayState: Readonly<GameplayRuntimeState>,
    screenState: Readonly<ScreenState>,
  ): void {
    const screen = screenState.currentScreen;
    this.updateBackground(screen, gameplayState.session.currentStageIndex);

    if (screen === 'title') {
      const vm = this.presenter.buildTitleViewModel(
        gameplayState.session,
        this.uiTexts,
        flowState.selectedDifficulty,
      );
      renderTitleScreen(this.titleObjects, vm, this.mascotStateProvider());
      hideRoundIntroScreen(this.roundIntroObjects);
      hideInGameScreen(this.inGameObjects);
      hideGameOverScreen(this.gameOverObjects);
      hideIntroStoryScreen(this.introStoryObjects);
      hideGameClearScreen(this.gameClearObjects);
    } else if (screen === 'introStory') {
      hideTitleScreen(this.titleObjects);
      hideRoundIntroScreen(this.roundIntroObjects);
      hideInGameScreen(this.inGameObjects);
      hideGameOverScreen(this.gameOverObjects);
      const vm = this.presenter.buildIntroScreenViewModel(
        screenState.introPageIndex,
        screenState.introTypingProgress,
        screenState.introPhase,
        this.introPages,
      );
      renderIntroStoryScreen(this.introStoryObjects, vm);
      hideGameClearScreen(this.gameClearObjects);
    } else if (screen === 'roundIntro') {
      hideTitleScreen(this.titleObjects);
      hideIntroStoryScreen(this.introStoryObjects);

      // Phase 2: RoundIntro 동안 InGame 뷰(블록·바·공)도 렌더한다.
      // 바는 깜빡 alpha 모듈레이션, 공은 부착 상태로 보임.
      const hudVm = this.hudPresenter.buildHudViewModel(gameplayState);
      const barBreakProgress = this.visualEffectController.getBarBreakProgress();
      const barAlpha = computeRoundIntroBarBlink(
        screenState.roundIntroRemainingTime,
        this.roundIntroDurationMs,
      );
      renderInGameScreen(
        this.scene,
        this.inGameObjects,
        gameplayState,
        hudVm,
        this.blockDefinitions,
        this.spinnerDefinitions,
        screenState,
        barBreakProgress,
        barAlpha,
        {
          ballInitialSpeed: GameplayConfigTable.ballInitialSpeed,
          ballInitialAngleDeg: GameplayConfigTable.ballInitialAngleDeg,
        },
        cheerMascotFromState(this.mascotStateProvider().selectedMascotId),
      );

      const vm = this.presenter.buildRoundIntroViewModel(
        gameplayState.session,
        this.uiTexts,
        screenState.roundIntroRemainingTime,
        this.roundIntroDurationMs,
      );
      renderRoundIntroScreen(this.roundIntroObjects, vm);
      hideGameOverScreen(this.gameOverObjects);
      hideGameClearScreen(this.gameClearObjects);
    } else if (screen === 'inGame') {
      hideTitleScreen(this.titleObjects);
      hideRoundIntroScreen(this.roundIntroObjects);
      hideIntroStoryScreen(this.introStoryObjects);
      const hudVm = this.hudPresenter.buildHudViewModel(gameplayState);
      const barBreakProgress = this.visualEffectController.getBarBreakProgress();
      renderInGameScreen(
        this.scene,
        this.inGameObjects,
        gameplayState,
        hudVm,
        this.blockDefinitions,
        this.spinnerDefinitions,
        screenState,
        barBreakProgress,
        1,
        {
          ballInitialSpeed: GameplayConfigTable.ballInitialSpeed,
          ballInitialAngleDeg: GameplayConfigTable.ballInitialAngleDeg,
        },
        cheerMascotFromState(this.mascotStateProvider().selectedMascotId),
      );
      hideGameOverScreen(this.gameOverObjects);
      hideGameClearScreen(this.gameClearObjects);
    } else if (screen === 'gameOver') {
      hideTitleScreen(this.titleObjects);
      hideRoundIntroScreen(this.roundIntroObjects);
      hideIntroStoryScreen(this.introStoryObjects);
      hideInGameScreen(this.inGameObjects);
      const vm = this.presenter.buildGameOverViewModel(
        gameplayState.session,
        this.uiTexts,
      );
      renderGameOverScreen(this.gameOverObjects, vm);
      hideGameClearScreen(this.gameClearObjects);
    } else if (screen === 'gameClear') {
      hideTitleScreen(this.titleObjects);
      hideRoundIntroScreen(this.roundIntroObjects);
      hideIntroStoryScreen(this.introStoryObjects);
      hideInGameScreen(this.inGameObjects);
      hideGameOverScreen(this.gameOverObjects);
      const vm = this.presenter.buildGameClearViewModel(
        gameplayState.session,
        this.uiTexts,
      );
      renderGameClearScreen(this.gameClearObjects, vm);
    }

    // flowState 사용 없음 — screenState.currentScreen이 동기화 소스
    void flowState;
  }
}

/** mascotId 로 응원 mascot placeholder 데이터 변환. */
function cheerMascotFromState(mascotId: string): { id: string; displayName: string; placeholderColor: number; placeholderStrokeColor: number } {
  const m = getMascotById(mascotId);
  return { id: mascotId, displayName: m.displayName, placeholderColor: m.placeholderColor, placeholderStrokeColor: m.placeholderStrokeColor };
}

/** mascotHandlers 미주입 시 안전한 no-op 기본값. SceneRenderer 단독 테스트용. */
function defaultMascotHandlers(): MascotCarouselHandlers {
  return {
    onCursorPrev: () => { /* noop */ },
    onCursorNext: () => { /* noop */ },
    onTryUnlock: () => { /* noop */ },
    getGold: () => 0,
    isUnlocked: () => true,
    getCursorIndex: () => 0,
  };
}

/**
 * RoundIntro 바 깜빡 alpha (Phase 2).
 * 2000ms 동안 약 4회 깜빡임. 짝수 절반은 0.35, 홀수는 1.0 (square wave).
 * 이렇게 하면 시각적 명료도가 sin 보다 더 좋다.
 */
function computeRoundIntroBarBlink(
  remainingMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0) return 1;
  const elapsed = durationMs - remainingMs;
  // 250ms 주기 (0.125s on / 0.125s off → 8 cycles in 2s 이지만 4 hard blink 이 명확).
  const cycle = Math.floor(elapsed / 250);
  return cycle % 2 === 0 ? 1.0 : 0.35;
}
