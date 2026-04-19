/**
 * easing.ts
 *
 * 순수 easing 함수 모음.
 * 프레임워크 비의존. Unity 포팅 시 C# Mathf 기반으로 1:1 대응 가능.
 */

/**
 * EaseOutCubic: 감속 곡선.
 * t=0이면 0, t=1이면 1.
 * 입력 t는 자동으로 [0, 1]로 clamp된다.
 */
export function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}
