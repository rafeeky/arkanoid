import Phaser from 'phaser';
import type { AppContext } from '../../app/createAppContext';
import type { KeyboardInputSource } from '../../input/KeyboardInputSource';
import { SceneRenderer } from './SceneRenderer';
import {
  PLAYFIELD_OFFSET_X,
  PLAYFIELD_OFFSET_Y,
  PLAYFIELD_WIDTH,
  PLAYFIELD_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './canvasLayout';
import {
  type PauseOverlayObjects,
  createPauseOverlayObjects,
  showPauseOverlay,
  hidePauseOverlay,
} from './renderPauseOverlay';
import { MascotTable } from '../../definitions/tables/MascotTable';
import type { UITextEntry } from '../../definitions/types/UITextEntry';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import type { IntroSequenceEntry } from '../../definitions/types/IntroSequenceEntry';
import type { DevContext } from '../../app/dev/DevContext';
import { DevOverlayRenderer } from './DevOverlayRenderer';
import { DevInputSource } from '../../input/DevInputSource';
import { PointerInputSource } from '../../input/PointerInputSource';
import { preloadAssets } from '../../assets/AssetLoader';

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
  private pointerInputSource!: PointerInputSource;
  private sceneRenderer!: SceneRenderer;

  // Dev 전용 — production 빌드에서는 undefined
  private devContext: DevContext | undefined;
  private devOverlayRenderer: DevOverlayRenderer | undefined;
  private devInputSource: DevInputSource | undefined;

  // RoundIntro 완료 발행 중복 방지 플래그
  private roundIntroFinishedFired = false;

  // ESC 일시정지 상태 + 오버레이 오브젝트.
  private isPaused = false;
  private pauseOverlay!: PauseOverlayObjects;

  // UI 카메라 — 줌/스크롤 면제. scrollFactor=0 오브젝트만 렌더.
  private uiCam!: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneInitData): void {
    this.appContext = data.appContext;
    this.keyboardInputSource = data.keyboardInputSource;
    this.devContext = data.devContext;
    // Mascot 캐러셀 cursor 는 Title 컴포넌트의 로컬 상태. 초기값 = 현재 selected 의 인덱스.
    const initialIdx = MascotTable.findIndex((m) => m.id === data.appContext.getSelectedMascot());
    this.mascotCursorIndex = initialIdx >= 0 ? initialIdx : 0;
    this.sceneRenderer = new SceneRenderer(
      this,
      data.uiTexts,
      data.blockDefinitions,
      data.spinnerDefinitions,
      data.appContext.getVisualEffectController(),
      data.roundIntroDurationMs,
      data.introPages,
      {
        onCursorPrev: () => {
          this.mascotCursorIndex = (this.mascotCursorIndex - 1 + MascotTable.length) % MascotTable.length;
          this.maybeAutoSelectAtCursor();
        },
        onCursorNext: () => {
          this.mascotCursorIndex = (this.mascotCursorIndex + 1) % MascotTable.length;
          this.maybeAutoSelectAtCursor();
        },
        onTryUnlock: () => {
          const mascot = MascotTable[this.mascotCursorIndex]!;
          if (this.appContext.tryUnlockMascot(mascot.id)) {
            this.appContext.selectMascot(mascot.id); // 해제 즉시 선택
          }
        },
        getGold: () => this.appContext.getGold(),
        isUnlocked: (id) => this.appContext.getUnlockedMascots().includes(id),
        getCursorIndex: () => this.mascotCursorIndex,
      },
      () => ({
        cursorIndex: this.mascotCursorIndex,
        gold: this.appContext.getGold(),
        isUnlocked: (id: string) => this.appContext.getUnlockedMascots().includes(id),
        selectedMascotId: this.appContext.getSelectedMascot(),
      }),
    );
  }

  private mascotCursorIndex = 0;

  /** cursor 가 unlocked mascot 위에 있으면 자동으로 selectMascot. */
  private maybeAutoSelectAtCursor(): void {
    const mascot = MascotTable[this.mascotCursorIndex]!;
    if (this.appContext.getUnlockedMascots().includes(mascot.id)) {
      this.appContext.selectMascot(mascot.id);
    }
  }

  preload(): void {
    // 모든 자산 (배경/블록/마스코트 프레임/portrait/intro story) 일괄 로드.
    preloadAssets(this);
  }

  create(): void {
    // Multi-camera 설정.
    // - main camera: 게임 월드용. zoom 1.5 로 720×720 플레이필드를 1080×1080 으로 시각 확대.
    //   centerOn(playfield 중심) 으로 캔버스 가로 꽉(0..1080) + 세로 가운데(420..1500) 배치.
    //   Phaser camera 는 origin(0.5, 0.5) 기본이라 zoom 이 카메라 중앙 기준 — centerOn 이 가장 깔끔.
    // - ui camera: HUD / Title / Pause overlay 용. zoom 1, scroll 0.
    //   기본 transparent — main 위에 합성됨.

    const ZOOM = 1.5;
    this.cameras.main.setZoom(ZOOM);
    this.cameras.main.centerOn(PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2);
    // 스테이지(inGame/roundIntro) 에서는 배경 이미지가 숨겨져 이 색이 노출된다.
    // 그 외 화면에서는 배경 이미지가 카메라 뷰포트를 덮으므로 이 색은 보이지 않음.
    this.cameras.main.setBackgroundColor('#87ceeb');

    this.uiCam = this.cameras.add(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.uiCam.setName('ui');
    this.uiCam.setZoom(1);
    this.uiCam.setScroll(0, 0);

    // 기존 PLAYFIELD_OFFSET_X/Y 상수는 단일 카메라 시절 잔재 — 더 이상 안 씀.
    void PLAYFIELD_OFFSET_X; void PLAYFIELD_OFFSET_Y;

    this.sceneRenderer.create();

    // 마우스/터치 슬라이더 입력 — 바 좌표(targetBarX) 를 산출해 InputSnapshot 에 주입.
    this.pointerInputSource = new PointerInputSource(this);

    // 일시정지 오버레이 — InGame 중 ESC 누르면 표시. 4개 버튼 (배경음/효과음/나가기/돌아가기).
    this.pauseOverlay = createPauseOverlayObjects(this, {
      onToggleBgm: () => this.appContext.setBgmMuted(!this.appContext.isBgmMuted()),
      onToggleSfx: () => this.appContext.setSfxMuted(!this.appContext.isSfxMuted()),
      onQuitToTitle: () => {
        // 합성 Q 입력으로 Flow 가 ReturnToTitleRequested 처리하게 함.
        this.appContext.tick(
          { leftDown: false, rightDown: false, spaceJustPressed: false, qJustPressed: true },
          0,
        );
        this.isPaused = false;
      },
      onResume: () => { this.isPaused = false; },
      isBgmMuted: () => this.appContext.isBgmMuted(),
      isSfxMuted: () => this.appContext.isSfxMuted(),
    });

    // Dev 모드: DevOverlayRenderer, DevInputSource 인스턴스화
    // production 빌드에서는 devContext === undefined 이므로 이 블록 진입 안 함
    if (this.devContext !== undefined) {
      this.devOverlayRenderer = new DevOverlayRenderer(this);
      this.devInputSource = new DevInputSource(this);
    }

    // Phase 1 placeholder 끝 — CANVAS_WIDTH/HEIGHT 참조 보존.
    void CANVAS_WIDTH;
    void CANVAS_HEIGHT;
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const kbInput = this.keyboardInputSource.readSnapshot();
    const targetBarX = this.pointerInputSource.readTargetBarX();
    // 슬라이더 첫 터치 = SPACE 등가 (공 발사 / 자석 해제). 키보드 SPACE 와 OR.
    const launchTap = this.pointerInputSource.consumeLaunchJustPressed();
    const mergedKb = launchTap
      ? { ...kbInput, spaceJustPressed: true }
      : kbInput;
    const input = targetBarX !== undefined ? { ...mergedKb, targetBarX } : mergedKb;
    const flowKindBefore = this.appContext.getFlowState().kind;

    // Dev 모드 전용: introStory 중 space 입력이면 즉시 intro 스킵.
    if (
      this.devContext !== undefined &&
      input.spaceJustPressed &&
      flowKindBefore === 'introStory'
    ) {
      this.appContext.skipIntroSequence();
    }

    // ESC 일시정지 토글 — InGame 일 때만 작동. 다른 화면에서 ESC 는 무시.
    if (input.escJustPressed && flowKindBefore === 'inGame') {
      this.isPaused = !this.isPaused;
    }
    // InGame 외 화면에선 paused 강제 해제 (다른 화면 진입 후에도 paused 유지되는 것 방지).
    if (flowKindBefore !== 'inGame') {
      this.isPaused = false;
    }

    // 일시정지 중에는 input 의 일부만 처리 (Q 는 통과시켜 타이틀 복귀 허용).
    // appContext.tick 자체를 건너뛰어 게임 시뮬레이션 정지.
    if (this.isPaused) {
      // Q 만 따로 흘려보내 Flow 가 ReturnToTitleRequested 처리하게 함.
      if (input.qJustPressed) {
        this.appContext.tick(
          { leftDown: false, rightDown: false, spaceJustPressed: false, qJustPressed: true },
          0,
        );
        this.isPaused = false; // 타이틀 전이 후 paused 해제
      }
      this.renderPaused();
      return;
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

    // 일시정지 오버레이 가시성 — paused 가 false 이면 항상 hide.
    hidePauseOverlay(this.pauseOverlay);

    // Multi-camera ignore 분류 갱신 (동적 오브젝트 포함).
    this.classifyCameras();

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

      // N: 현재 스테이지 강제 클리어 → 다음 스테이지 로드 (디버그 용)
      if (this.devInputSource.isSkipStagePressed()) {
        this.appContext.skipStage();
      }

      // 오버레이 렌더링
      this.devOverlayRenderer.render(gameplayState, flowState, this.devContext);
    }
  }

  /**
   * 일시정지 중 렌더 — 게임 화면은 마지막 상태로 freeze 된 채,
   * 그 위에 PAUSED 오버레이만 표시.
   */
  private renderPaused(): void {
    const flowState = this.appContext.getFlowState();
    const screenState = this.appContext.getScreenState();
    const gameplayState = this.appContext.getGameplayState();
    this.sceneRenderer.render(flowState, gameplayState, screenState);
    showPauseOverlay(
      this.pauseOverlay,
      this.appContext.isBgmMuted(),
      this.appContext.isSfxMuted(),
    );
    // 분류 갱신 (pause overlay 등 새 오브젝트 처리)
    this.classifyCameras();
  }

  /**
   * Multi-camera ignore 분류.
   * 매 프레임 호출 — scrollFactor (0,0) 인 오브젝트는 main 에서 ignore (UI 카메라 전용),
   * 그 외 (scroll factor 1) 오브젝트는 UI 에서 ignore (main 카메라 전용).
   * 동적 추가되는 블록/아이템 등도 자동 분류.
   */
  private classifyCameras(): void {
    if (!this.uiCam) return;
    for (const obj of this.children.list) {
      // 배경 이미지는 main 카메라 전용. UI 카메라가 main 위에 그려지므로
      // 배경을 UI 에 두면 게임 오브젝트를 가린다.
      const name = (obj as unknown as { name?: string }).name;
      if (name === '__background__') {
        this.uiCam.ignore(obj);
        continue;
      }
      // setScrollFactor(0) 호출 후 scrollFactorX/Y 가 0 으로 세팅됨.
      // Phaser GameObject 가 scrollFactorX 속성을 지원하는 타입만 처리.
      const sfx = (obj as unknown as { scrollFactorX?: number }).scrollFactorX;
      const sfy = (obj as unknown as { scrollFactorY?: number }).scrollFactorY;
      const isUI = sfx === 0 && sfy === 0;
      if (isUI) {
        // UI 전용 — main 에서 숨김
        this.cameras.main.ignore(obj);
      } else {
        // 게임 월드 전용 — UI 에서 숨김
        this.uiCam.ignore(obj);
      }
    }
  }
}
