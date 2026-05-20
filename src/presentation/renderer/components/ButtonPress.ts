import type Phaser from 'phaser';

/**
 * addPressAnimation — 버튼 눌릴 때 y 가 2px 아래로 (눌리는 느낌).
 * pointerup/out 시 원복.
 *
 * 사용:
 *   addPressAnimation(rect, [rect, label, bevel]);
 *
 * @param trigger interactive 객체 (보통 rect)
 * @param targets 같이 움직일 모든 객체 (rect + label + bevel 등). origin/위치 어떤거든 OK — 단순 y 보정.
 */
export function addPressAnimation(
  trigger: Phaser.GameObjects.GameObject,
  targets: ReadonlyArray<{ y: number }>,
): void {
  const PRESS_OFFSET = 2;
  const baseline: number[] = targets.map((t) => t.y);
  let pressed = false;

  const press = (): void => {
    if (pressed) return;
    pressed = true;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]!;
      baseline[i] = t.y;
      t.y = t.y + PRESS_OFFSET;
    }
  };
  const release = (): void => {
    if (!pressed) return;
    pressed = false;
    for (let i = 0; i < targets.length; i++) {
      targets[i]!.y = baseline[i]!;
    }
  };

  trigger.on('pointerdown', press);
  trigger.on('pointerup', release);
  trigger.on('pointerout', release);
  trigger.on('pointerupoutside', release);
}
