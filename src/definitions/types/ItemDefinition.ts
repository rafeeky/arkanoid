export type ItemDefinition = {
  itemType: 'expand' | 'magnet' | 'laser';
  displayNameTextId: string;
  descriptionTextId: string;
  iconId: string;
  fallSpeed: number;
  effectType: 'expand' | 'magnet' | 'laser';
  expandMultiplier?: number;
  magnetDurationMs?: number;
  laserCooldownMs?: number;
  laserShotCount?: number;
};
