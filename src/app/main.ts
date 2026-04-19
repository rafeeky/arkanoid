import Phaser from 'phaser';
import { createAppContext } from './createAppContext';
import type { AppContext } from './createAppContext';
import { KeyboardInputSource } from '../input/KeyboardInputSource';
import { GameScene } from '../presentation/renderer/GameScene';
import { UITextTable } from '../definitions/tables/UITextTable';
import { BlockDefinitionTable } from '../definitions/tables/BlockDefinitionTable';
import { GameplayConfigTable } from '../definitions/tables/GameplayConfigTable';
import { LocalSaveRepository } from '../persistence/LocalSaveRepository';

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
 * createGame — Phaser.Game 인스턴스를 생성한다.
 */
function createGame(appContext: AppContext): Phaser.Game {
  /**
   * GameSceneBootstrap — GameScene을 상속하여 init() 에서 KeyboardInputSource 를 생성 주입한다.
   * KeyboardInputSource 는 Phaser.Scene 참조가 필요하므로 Scene 내부에서 생성한다.
   * Unity 매핑: 동일한 MonoBehaviour 가 Awake() 에서 컴포넌트를 조립하는 것에 해당.
   */
  class GameSceneBootstrap extends GameScene {
    override init(_data: unknown): void {
      const kbSource = new KeyboardInputSource(this);
      super.init({
        appContext,
        keyboardInputSource: kbSource,
        uiTexts: UITextTable,
        blockDefinitions: BlockDefinitionTable,
        roundIntroDurationMs: GameplayConfigTable.roundIntroDurationMs,
      });
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 960,
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
  createGame(appContext);

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
