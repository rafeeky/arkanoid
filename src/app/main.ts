import Phaser from 'phaser';

/**
 * BootScene — Phase 0 자리지킴이 씬.
 * Phase 5에서 ScreenDirector / SceneRenderer로 교체된다.
 * Unity 매핑: GameplayRunner MonoBehaviour의 Start() 진입점에 해당.
 */
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.add
      .text(480, 360, 'Hello Arkanoid', {
        fontSize: '40px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5, 0.5);
  }
}

/**
 * createGame — Phaser.Game 인스턴스를 생성한다.
 * AppContext 조립부(app/)에서만 호출한다.
 * Phaser API 사용은 이 레이어(app/presentation)에서만 허용된다.
 */
function createGame(): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 960,
    height: 720,
    backgroundColor: '#000000',
    parent: 'app',
    scene: [BootScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}

createGame();
