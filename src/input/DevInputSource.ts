import Phaser from 'phaser';

/**
 * DevInputSource — F1/F2/F3 개발 전용 키 입력 감지.
 *
 * KeyboardInputSource 와 별도로 존재한다. 게임 입력과 분리해
 * 개발 도구 제어에만 사용한다.
 *
 * Phaser.Input.Keyboard.JustDown 을 사용하므로 프레임당 1회만 true 를 반환한다.
 *
 * Unity 매핑: DebugInputAdapter MonoBehaviour. Input.GetKeyDown 사용에 대응.
 *             Editor 전용 #if UNITY_EDITOR 가드 또는 Development Build 전용 처리.
 */
export class DevInputSource {
  private readonly f1Key: Phaser.Input.Keyboard.Key;
  private readonly f2Key: Phaser.Input.Keyboard.Key;
  private readonly f3Key: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.f1Key = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
    this.f2Key = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
    this.f3Key = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
  }

  /**
   * isToggleOverlayPressed — F1 단일 눌림 감지 (오버레이 on/off 토글용).
   * 프레임당 최대 1회만 true.
   */
  isToggleOverlayPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.f1Key);
  }

  /**
   * isExportReplayPressed — F2 단일 눌림 감지 (replay JSON 내보내기용).
   * 프레임당 최대 1회만 true.
   */
  isExportReplayPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.f2Key);
  }

  /**
   * isClearLogPressed — F3 단일 눌림 감지 (충돌 로그 초기화용).
   * 프레임당 최대 1회만 true.
   */
  isClearLogPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.f3Key);
  }
}
