export type LaserShotState = {
  id: string;    // e.g. `laser_0`, `laser_1`
  x: number;
  y: number;
  vy: number;    // 레이저는 위로만 이동 (음수)
};
