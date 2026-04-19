export type HudViewModel = {
  score: number;
  lives: number;
  round: number;
  /** 현재 활성 바 효과. */
  activeEffect: 'none' | 'expand' | 'magnet' | 'laser';
  /** 자석 효과 남은 시간 (ms). activeEffect が 'magnet' でないときは 0. */
  magnetRemainingMs: number;
  /** 레이저 쿨다운 남은 시간 (ms). activeEffect が 'laser' でないときは 0. */
  laserCooldownMs: number;
};
