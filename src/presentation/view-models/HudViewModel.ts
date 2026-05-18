export type HudViewModel = {
  score: number;
  /** Phase 4: HIGH SCORE 중앙상단 표시용. */
  highScore: number;
  lives: number;
  round: number;
  /** 현재 활성 바 효과. */
  activeEffect: 'none' | 'expand' | 'magnet' | 'laser';
  /** 자석 효과 남은 시간 (ms). 호환용 — 새 동작은 magnetRemainingUses. */
  magnetRemainingMs: number;
  /** 자석 효과 남은 부착 횟수. activeEffect 가 'magnet' 아닐 때 0. */
  magnetRemainingUses?: number;
  /** 레이저 쿨다운 남은 시간 (ms). activeEffect が 'laser' でないときは 0. */
  laserCooldownMs: number;
  /** 레이저 효과 남은 지속 시간 (ms). activeEffect 가 'laser' 아닐 때 0. */
  laserRemainingMs?: number;
};
