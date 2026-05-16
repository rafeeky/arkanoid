import Phaser from 'phaser';
import { LayoutConfigTable } from '../definitions/tables/LayoutConfigTable';

/**
 * PointerInputSource — 마우스/터치 드래그를 게임 바 위치(targetBarX) 로 변환.
 *
 * 슬라이더 트랙 영역 위에서 pointerdown → dragActive=true. drag 중 pointer x 가
 * 트랙 비율로 매핑되어 targetBarX (playfield 좌표) 를 계산. pointerup → clear.
 *
 * Unity 매핑: TouchInputAdapter MonoBehaviour. Input.GetTouch / EventSystems
 *             PointerEventData 를 동일한 targetBarX 형태로 노출.
 */
export class PointerInputSource {
  private dragActive = false;
  private targetBarX: number | undefined = undefined;

  constructor(scene: Phaser.Scene) {
    scene.input.on('pointerdown', this.handleDown);
    scene.input.on('pointermove', this.handleMove);
    scene.input.on('pointerup', this.handleUp);
    scene.input.on('pointerupoutside', this.handleUp);
  }

  /** 현재 targetBarX (드래그 중이면 값, 아니면 undefined). */
  readTargetBarX(): number | undefined {
    return this.targetBarX;
  }

  private handleDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.isInSliderArea(pointer.x, pointer.y)) return;
    this.dragActive = true;
    this.targetBarX = this.pointerToBarX(pointer.x);
  };

  private handleMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.dragActive || !pointer.isDown) return;
    this.targetBarX = this.pointerToBarX(pointer.x);
  };

  private handleUp = (): void => {
    this.dragActive = false;
    this.targetBarX = undefined;
  };

  /**
   * 슬라이더 hit-area: 트랙 + 노브 반지름까지 포함한 세로 띠.
   * 캔버스 가로 전체에 걸쳐 노브 반지름의 2배 정도 세로 영역.
   */
  private isInSliderArea(cx: number, cy: number): boolean {
    const L = LayoutConfigTable.barSlider;
    const trackCenterX = LayoutConfigTable.canvas.width / 2;
    const trackLeft = trackCenterX - L.trackHalfWidth;
    const trackRight = trackCenterX + L.trackHalfWidth;
    // 가로: 트랙 + 노브 반지름 여유
    const hitLeft = trackLeft - L.knobRadius;
    const hitRight = trackRight + L.knobRadius;
    // 세로: 노브 반지름 + 작은 여유
    const hitTop = L.centerY - L.knobRadius - 10;
    const hitBottom = L.centerY + L.knobRadius + 10;
    return cx >= hitLeft && cx <= hitRight && cy >= hitTop && cy <= hitBottom;
  }

  /**
   * pointer.x (캔버스 좌표) → 플레이필드 바 x 좌표.
   * 트랙 양 끝을 바의 좌/우 한계 (bar.halfWidth, playfield.width - bar.halfWidth) 에 매핑.
   * 바 폭은 LayoutConfigTable 에 없으므로 baseBarWidth 의 절반 = 60 을 사용 (default).
   * 확장 효과로 바 폭이 변하면 실제 clamp 는 moveBar 에서 다시 한 번 적용됨.
   */
  private pointerToBarX(pointerCx: number): number {
    const L = LayoutConfigTable.barSlider;
    const trackCenterX = LayoutConfigTable.canvas.width / 2;
    const trackLeft = trackCenterX - L.trackHalfWidth;
    const trackRight = trackCenterX + L.trackHalfWidth;
    const clampedCx = Math.max(trackLeft, Math.min(trackRight, pointerCx));
    const ratio = (clampedCx - trackLeft) / (trackRight - trackLeft);

    const halfBar = 60;
    const playfieldMinX = halfBar;
    const playfieldMaxX = LayoutConfigTable.playfield.width - halfBar;
    return playfieldMinX + ratio * (playfieldMaxX - playfieldMinX);
  }
}
