export type ItemDefinition = {
  itemType: 'expand' | 'magnet' | 'laser';
  displayNameTextId: string;
  descriptionTextId: string;
  iconId: string;
  fallSpeed: number;
  effectType: 'expand' | 'magnet' | 'laser';
  expandMultiplier?: number;
  /** @deprecated 시간 기반 magnet 효과 (호환용 유지). 새 동작은 magnetUseCount 사용. */
  magnetDurationMs?: number;
  /** magnet 효과 동안 공 부착 가능 횟수 (release 1회당 차감, 0 도달 시 효과 종료). */
  magnetUseCount?: number;
  laserCooldownMs?: number;
  laserShotCount?: number;
  /** laser 효과 지속 시간 (ms). 0 도달 시 효과 종료. */
  laserDurationMs?: number;
};
