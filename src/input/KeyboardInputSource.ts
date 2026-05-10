import Phaser from 'phaser';
import type { InputSnapshot } from './InputSnapshot';

/**
 * KeyboardInputSource — Phaser 키보드 API를 InputSnapshot으로 변환하는 어댑터.
 *
 * Phaser API는 이 파일 안에서만 사용한다.
 *
 * 추가된 키 (묶음 E/F):
 * - Q: 어느 상태에서든 타이틀 복귀
 * - ←/→ edge: Title 화면에서 난이도 커서 (NORMAL/HARD) 이동
 *
 * Unity 매핑: Input Adapter MonoBehaviour. InputSystem.GetKey / GetKeyDown 호출 후
 * InputSnapshot 반환 형태로 포팅된다.
 */
export class KeyboardInputSource {
  private leftKey: Phaser.Input.Keyboard.Key;
  private rightKey: Phaser.Input.Keyboard.Key;
  private spaceKey: Phaser.Input.Keyboard.Key;
  private qKey: Phaser.Input.Keyboard.Key;
  private escKey: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.leftKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.qKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  readSnapshot(): InputSnapshot {
    return {
      leftDown: this.leftKey.isDown,
      rightDown: this.rightKey.isDown,
      spaceJustPressed: Phaser.Input.Keyboard.JustDown(this.spaceKey),
      qJustPressed: Phaser.Input.Keyboard.JustDown(this.qKey),
      escJustPressed: Phaser.Input.Keyboard.JustDown(this.escKey),
      leftJustPressed: Phaser.Input.Keyboard.JustDown(this.leftKey),
      rightJustPressed: Phaser.Input.Keyboard.JustDown(this.rightKey),
    };
  }
}
