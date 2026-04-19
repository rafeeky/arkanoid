import Phaser from 'phaser';
import type { AppContext } from '../../app/createAppContext';
import type { KeyboardInputSource } from '../../input/KeyboardInputSource';
import { SceneRenderer } from './SceneRenderer';
import type { UITextEntry } from '../../definitions/types/UITextEntry';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';

export type GameSceneInitData = {
  appContext: AppContext;
  keyboardInputSource: KeyboardInputSource;
  uiTexts: readonly UITextEntry[];
  blockDefinitions: Readonly<Record<string, BlockDefinition>>;
  roundIntroDurationMs: number;
};

/**
 * GameScene — 단일 Phaser.Scene. ScreenState에 따라 요소를 show/hide.
 *
 * Phase 6 리팩토링:
 * - ScreenDirector 를 AppContext 로 이전했으므로 GameScene 에서 제거.
 * - appContext.getScreenState() 로 현재 ScreenState 를 읽는다.
 * - SceneRenderer 에 VisualEffectController 를 주입해 barBreakProgress 를 얻는다.
 *
 * 여러 Phaser Scene 분리 금지 (Unity 포팅 관점에서 UI 패널 전환 구조가 적합).
 * Unity 매핑: GameplayRunner MonoBehaviour. Update() 진입점에 해당.
 */
export class GameScene extends Phaser.Scene {
  private appContext!: AppContext;
  private keyboardInputSource!: KeyboardInputSource;
  private sceneRenderer!: SceneRenderer;

  // RoundIntro 완료 발행 중복 방지 플래그
  private roundIntroFinishedFired = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneInitData): void {
    this.appContext = data.appContext;
    this.keyboardInputSource = data.keyboardInputSource;
    this.sceneRenderer = new SceneRenderer(
      this,
      data.uiTexts,
      data.blockDefinitions,
      data.appContext.getVisualEffectController(),
      data.roundIntroDurationMs,
    );
  }

  create(): void {
    this.sceneRenderer.create();
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const input = this.keyboardInputSource.readSnapshot();

    // AppContext.tick() 내부에서 ScreenDirector.update 도 호출됨
    this.appContext.tick(input, dt);

    const flowState = this.appContext.getFlowState();
    const screenState = this.appContext.getScreenState();

    // roundIntroRemainingTime 이 0 이하로 내려가면 RoundIntroFinished 를 1회만 발행
    if (
      flowState.kind === 'roundIntro' &&
      screenState.roundIntroRemainingTime <= 0 &&
      !this.roundIntroFinishedFired
    ) {
      this.roundIntroFinishedFired = true;
      this.appContext.handlePresentationEvent({ type: 'RoundIntroFinished' });
    }

    // roundIntro 에서 벗어나면 플래그 리셋 (다음 RoundIntro 를 위해)
    if (flowState.kind !== 'roundIntro') {
      this.roundIntroFinishedFired = false;
    }

    const gameplayState = this.appContext.getGameplayState();
    this.sceneRenderer.render(flowState, gameplayState, screenState);
  }
}
