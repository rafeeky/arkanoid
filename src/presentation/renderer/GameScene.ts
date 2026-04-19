import Phaser from 'phaser';
import type { AppContext } from '../../app/createAppContext';
import type { KeyboardInputSource } from '../../input/KeyboardInputSource';
import { SceneRenderer } from './SceneRenderer';
import type { UITextEntry } from '../../definitions/types/UITextEntry';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import type { IntroSequenceEntry } from '../../definitions/types/IntroSequenceEntry';
import type { DevContext } from '../../app/dev/DevContext';
import { DevOverlayRenderer } from './DevOverlayRenderer';
import { DevInputSource } from '../../input/DevInputSource';

export type GameSceneInitData = {
  appContext: AppContext;
  keyboardInputSource: KeyboardInputSource;
  uiTexts: readonly UITextEntry[];
  blockDefinitions: Readonly<Record<string, BlockDefinition>>;
  spinnerDefinitions: Readonly<Record<string, SpinnerDefinition>>;
  introPages: readonly IntroSequenceEntry[];
  roundIntroDurationMs: number;
  /** Dev 모드 전용. production 빌드에서는 undefined.
   * exactOptionalPropertyTypes: true 이므로 명시적으로 | undefined 포함. */
  devContext?: DevContext | undefined;
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

  // Dev 전용 — production 빌드에서는 undefined
  private devContext: DevContext | undefined;
  private devOverlayRenderer: DevOverlayRenderer | undefined;
  private devInputSource: DevInputSource | undefined;

  // RoundIntro 완료 발행 중복 방지 플래그
  private roundIntroFinishedFired = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneInitData): void {
    this.appContext = data.appContext;
    this.keyboardInputSource = data.keyboardInputSource;
    this.devContext = data.devContext;
    this.sceneRenderer = new SceneRenderer(
      this,
      data.uiTexts,
      data.blockDefinitions,
      data.spinnerDefinitions,
      data.appContext.getVisualEffectController(),
      data.roundIntroDurationMs,
      data.introPages,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  preload(): void {
    // 기본 구현: 아무 동작 없음. 서브클래스에서 override 가능.
  }

  create(): void {
    this.sceneRenderer.create();

    // Dev 모드: DevOverlayRenderer, DevInputSource 인스턴스화
    // production 빌드에서는 devContext === undefined 이므로 이 블록 진입 안 함
    if (this.devContext !== undefined) {
      this.devOverlayRenderer = new DevOverlayRenderer(this);
      this.devInputSource = new DevInputSource(this);
    }
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const input = this.keyboardInputSource.readSnapshot();

    // Dev 모드 전용: introStory 중 space 입력이면 즉시 intro 스킵.
    // appContext.tick() 호출 전에 처리해 이번 틱에 바로 RoundIntro 로 전이.
    if (
      this.devContext !== undefined &&
      input.spaceJustPressed &&
      this.appContext.getFlowState().kind === 'introStory'
    ) {
      this.appContext.skipIntroSequence();
    }

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

    // Dev 모드 처리 — devContext/devOverlayRenderer/devInputSource 는 함께 초기화되므로
    // devContext の存在チェックのみで十分だが、型安全のために個別チェックする。
    if (this.devContext !== undefined && this.devInputSource !== undefined && this.devOverlayRenderer !== undefined) {
      // F1: 오버레이 토글
      if (this.devInputSource.isToggleOverlayPressed()) {
        this.devContext.isEnabled = !this.devContext.isEnabled;
      }

      // F2: Replay JSON export → 콘솔 + 클립보드
      if (this.devInputSource.isExportReplayPressed()) {
        const json = this.devContext.replayRecorder.exportJson();
        console.log('REPLAY:', json);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(json).catch((err: unknown) => {
            console.warn('[Dev] 클립보드 복사 실패:', err);
          });
        }
      }

      // F3: 충돌 로그 초기화
      if (this.devInputSource.isClearLogPressed()) {
        this.devContext.collisionLog.clear();
      }

      // 오버레이 렌더링
      this.devOverlayRenderer.render(gameplayState, flowState, this.devContext);
    }
  }
}
