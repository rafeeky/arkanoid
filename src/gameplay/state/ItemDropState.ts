export type ItemDropState = {
  id: string;
  itemType: 'expand' | 'magnet' | 'laser';
  x: number;
  y: number;
  fallSpeed: number;
  isCollected: boolean;
};
