export type BallState = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isActive: boolean;
  /**
   * 자석 효과로 바에 부착 중일 때, 바 중심 대비 x 오프셋(px).
   * 부착 시 세팅, 해제 시 undefined.
   */
  attachedOffsetX?: number;
};
