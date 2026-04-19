export type BarState = {
  x: number;
  y: number;
  width: number;
  moveSpeed: number;
  activeEffect: 'none' | 'expand' | 'magnet' | 'laser';
};
