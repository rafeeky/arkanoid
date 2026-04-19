import type Phaser from 'phaser';
import type { GameFlowState } from '../../flow/state/GameFlowState';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';
import type { ScreenState } from '../state/ScreenState';
import type { UITextEntry } from '../../definitions/types/UITextEntry';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { VisualEffectController } from '../controller/VisualEffectController';

import { ScreenPresenter } from '../controller/ScreenPresenter';
import { HUDPresenter } from '../controller/HUDPresenter';

import {
  type TitleScreenObjects,
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

/**
 * SceneRenderer — GameScene에서 인스턴스화되어 4개 화면 렌더링을 담당한다.
 *
 * create() 단계에서 모든 Phaser 오브젝트를 1회 생성하고,
 * render() 에서 매 프레임 visible/position/text만 갱신한다.
 *
 * Phase 6: VisualEffectController 를 주입받아 barBreakProgress 를 렌더러에 전달한다.
 *
 * Unity 매핑: ScreenViewRoot MonoBehaviour. 각 sub-renderer는 자식 MonoBehaviour로 분리된다.
 */
export class SceneRenderer {
  private readonly scene: Phaser.Scene;
  private readonly presenter: ScreenPresenter;
  private readonly hudPresenter: HUDPresenter;
  private readonly uiTexts: readonly UITextEntry[];
  private readonly blockDefinitions: Readonly<Record<string, BlockDefinition>>;
  private readonly visualEffectController: VisualEffectController;
  private readonly roundIntroDurationMs: number;

  private titleObjects!: TitleScreenObjects;
  private roundIntroObjects!: RoundIntroScreenObjects;
  private inGameObjects!: InGameObjects;
  private gameOverObjects!: GameOverScreenObjects;

  constructor(
    scene: Phaser.Scene,
    uiTexts: readonly UITextEntry[],
    blockDefinitions: Readonly<Record<string, BlockDefinition>>,
    visualEffectController: VisualEffectController,
    roundIntroDurationMs: number = 1500,
  ) {
    this.scene = scene;
    this.uiTexts = uiTexts;
    this.blockDefinitions = blockDefinitions;
    this.visualEffectController = visualEffectController;
    this.roundIntroDurationMs = roundIntroDurationMs;
    this.presenter = new ScreenPresenter();
    this.hudPresenter = new HUDPresenter();
  }

  /**
   * create — Phaser.Scene.create() 에서 1회 호출. 모든 오브젝트를 미리 생성한다.
   */
  create(): void {
    this.titleObjects = createTitleScreenObjects(this.scene);
    this.roundIntroObjects = createRoundIntroScreenObjects(this.scene);
    this.inGameObjects = createInGameObjects(this.scene);
    this.gameOverObjects = createGameOverScreenObjects(this.scene);
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

    if (screen === 'title') {
      const vm = this.presenter.buildTitleViewModel(
        gameplayState.session,
        this.uiTexts,
      );
      renderTitleScreen(this.titleObjects, vm);
      hideRoundIntroScreen(this.roundIntroObjects);
      hideInGameScreen(this.inGameObjects);
      hideGameOverScreen(this.gameOverObjects);
    } else if (screen === 'roundIntro') {
      hideTitleScreen(this.titleObjects);
      const vm = this.presenter.buildRoundIntroViewModel(
        gameplayState.session,
        this.uiTexts,
        screenState.roundIntroRemainingTime,
        this.roundIntroDurationMs,
      );
      renderRoundIntroScreen(this.roundIntroObjects, vm);
      hideInGameScreen(this.inGameObjects);
      hideGameOverScreen(this.gameOverObjects);
    } else if (screen === 'inGame') {
      hideTitleScreen(this.titleObjects);
      hideRoundIntroScreen(this.roundIntroObjects);
      const hudVm = this.hudPresenter.buildHudViewModel(gameplayState.session);
      const barBreakProgress = this.visualEffectController.getBarBreakProgress();
      renderInGameScreen(
        this.scene,
        this.inGameObjects,
        gameplayState,
        hudVm,
        this.blockDefinitions,
        screenState,
        barBreakProgress,
      );
      hideGameOverScreen(this.gameOverObjects);
    } else if (screen === 'gameOver') {
      hideTitleScreen(this.titleObjects);
      hideRoundIntroScreen(this.roundIntroObjects);
      hideInGameScreen(this.inGameObjects);
      const vm = this.presenter.buildGameOverViewModel(
        gameplayState.session,
        this.uiTexts,
      );
      renderGameOverScreen(this.gameOverObjects, vm);
    }

    // flowState 사용 없음 — screenState.currentScreen이 동기화 소스
    void flowState;
  }
}
