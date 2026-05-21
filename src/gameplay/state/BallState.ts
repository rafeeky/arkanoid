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
  /**
   * 바(paddle) 충돌 *이후* 깬 블록 개수. 바에 맞으면 0 으로 reset.
   * 벽 튕김은 reset 안 함. 이 값이 임계점 (현재 2) 도달 시 isPowered=true.
   * 옵셔널 — 옛 ball 또는 init 시점은 undefined → fallback 0.
   */
  blocksSincePaddle?: number;
  /**
   * 파워 상태 — blocksSincePaddle ≥ 2 일 때 true. 바 충돌 시 false.
   * 시각 (트레일) 표시 전용 — 게임플레이 영향 X.
   */
  isPowered?: boolean;
};
