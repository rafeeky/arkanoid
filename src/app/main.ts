import Phaser from 'phaser';
import { createAppContext } from './createAppContext';
import type { AppContext } from './createAppContext';
import { KeyboardInputSource } from '../input/KeyboardInputSource';
import { GameScene } from '../presentation/renderer/GameScene';
import { UITextTable } from '../definitions/tables/UITextTable';
import { BlockDefinitionTable } from '../definitions/tables/BlockDefinitionTable';
import { GameplayConfigTable } from '../definitions/tables/GameplayConfigTable';
import { LocalSaveRepository } from '../persistence/LocalSaveRepository';
import { PhaserAudioPlayer } from '../audio/PhaserAudioPlayer';
import { AssetResolver } from '../assets/AssetResolver';
import { AudioCueTable } from '../definitions/tables/AudioCueTable';
import { IntroSequenceTable } from '../definitions/tables/IntroSequenceTable';
import type { DevContext } from './dev/DevContext';
import { createDevContext } from './dev/DevContext';

/**
 * main.ts — Phaser.Game 인스턴스 생성 및 AppContext 조립.
 *
 * Phaser API 사용은 이 레이어(app/presentation)에서만 허용.
 * Unity 매핑: GameBootstrap MonoBehaviour 의 Awake()/Start() 에 해당.
 *
 * createAppContext 가 async(saveRepository.load() 포함)이므로
 * Phaser.Game 생성 전에 await 하여 초기 highScore 가 세팅된 상태를 보장한다.
 */

/**
 * isDevMode — dev 모드 판정.
 *
 * 다음 조건 중 하나라도 참이면 dev 모드:
 *   1. Vite 개발 서버 실행 중 (import.meta.env.DEV)
 *   2. URL 쿼리 파라미터 ?dev=1
 *
 * production 빌드에서는 import.meta.env.DEV 가 false 로 tree-shake 되므로
 * dev 코드가 번들에 포함되지 않는다.
 */
function isDevMode(): boolean {
  if (import.meta.env.DEV) return true;
  return new URLSearchParams(window.location.search).get('dev') === '1';
}

/**
 * createGame — Phaser.Game 인스턴스를 생성한다.
 */
function createGame(appContext: AppContext, devContext: DevContext | undefined): Phaser.Game {
  const assetResolver = new AssetResolver();
  const phaserAudioPlayer = new PhaserAudioPlayer(assetResolver);

  /**
   * GameSceneBootstrap — GameScene을 상속하여 init()/preload()/create() 에서
   * KeyboardInputSource, PhaserAudioPlayer 를 초기화하고 AppContext 에 주입한다.
   *
   * 초기화 순서:
   * 1. init(): KeyboardInputSource 생성
   * 2. preload(): PhaserAudioPlayer.preload() — audio 파일 등록
   * 3. create(): PhaserAudioPlayer.create() — sound 인스턴스 생성 후 AppContext에 swap
   *
   * Unity 매핑: 동일한 MonoBehaviour 가 Awake()/Start() 에서 컴포넌트를 조립하는 것에 해당.
   */
  class GameSceneBootstrap extends GameScene {
    override init(_data: unknown): void {
      const kbSource = new KeyboardInputSource(this);
      super.init({
        appContext,
        keyboardInputSource: kbSource,
        uiTexts: UITextTable,
        blockDefinitions: BlockDefinitionTable,
        introPages: IntroSequenceTable,
        roundIntroDurationMs: GameplayConfigTable.roundIntroDurationMs,
        devContext,
      });
    }

    override preload(): void {
      super.preload();
      phaserAudioPlayer.preload(this, AudioCueTable);
    }

    override create(): void {
      super.create();
      phaserAudioPlayer.create(this, AudioCueTable);
      // Phaser가 준비된 시점에 AppContext에 실제 AudioPlayer swap
      appContext.setAudioPlayer(phaserAudioPlayer);
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 720,
    height: 720,
    backgroundColor: '#000000',
    parent: 'app',
    scene: [GameSceneBootstrap],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    pixelArt: false,
  });
}

// AppContext를 await한 후 Phaser 시작 — 초기 highScore 로드 완료 보장
const saveRepo = new LocalSaveRepository('arkanoid.save.v1');
createAppContext({ saveRepository: saveRepo }).then((appContext) => {
  // Dev 모드: DevContext 생성 (production 빌드에서는 undefined)
  // seed는 Date.now() — 세션별 고유. stageIndex는 0부터 시작.
  const devContext: DevContext | undefined = isDevMode()
    ? createDevContext(Date.now(), 0)
    : undefined;
  createGame(appContext, devContext);

  // JSON Hot-Reload (Vite HMR)
  // stage1.json 변경 시, Flow 상태가 title 또는 roundIntro 이면 즉시 반영.
  // InGame 도중 변경은 "다음 RoundIntro부터 반영" 정책.
  type ViteHot = {
    accept(dep: string, cb: () => void): void;
    invalidate(): void;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viteHot = (import.meta as any).hot as ViteHot | undefined;
  if (viteHot) {
    const hot = viteHot;
    hot.accept('../definitions/data/stage1.json', () => {
      const flowKind = appContext.getFlowState().kind;
      if (flowKind === 'title' || flowKind === 'roundIntro') {
        // createAppContext 는 모듈 레벨에서 재생성이 어려우므로,
        // HMR 시에는 페이지 전체를 리로드한다.
        hot.invalidate();
      }
      // InGame 중이면 무시 (다음 RoundIntro 때 모듈 재로드로 자동 반영됨)
    });
  }
});
