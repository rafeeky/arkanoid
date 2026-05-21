/**
 * 충돌/반사 물리 튜닝 값. 게임 느낌(반사각, 안티터널링 정밀도)을 결정.
 * 디자이너가 JSON에서 직접 만질 수 있도록 코드 const 가 아니라 config 데이터로 둔다.
 */
export type PhysicsConfig = {
  /** sub-step 1회당 진행 픽셀 수. 작을수록 터널링 안전, 비용 증가. */
  subStepSize: number;
  /** 한 틱당 sub-step 최대 횟수. 폭주 방지. */
  maxSubSteps: number;
  /** 충돌 후 push-out 거리 (벽/블럭 공통). 블럭과 공의 strict separation 보장. */
  pushOutEpsilon: number;
  /** 공 반사 후 강제 최소 각도 (수평/수직축에서의). 무한 핑퐁 방지. */
  minAngleDeg: number;
  /** 바 반사 시 contactX → vx 변환 계수. 1.0 에 가까울수록 가장자리 반사가 가파름. */
  barContactBias: number;
};

export type GameplayConfig = {
  initialLives: number;
  baseBarWidth: number;
  barMoveSpeed: number;
  ballInitialSpeed: number;
  ballInitialAngleDeg: number;
  roundIntroDurationMs: number;
  blockHitFlashDurationMs: number;
  barBreakDurationMs: number;
  expandMultiplier: number;
  /** 라운드 시작 후 공 발사 안 하면 N ms 후 자동 발사. 데이터 제어용. */
  autoLaunchDelayMs: number;
  physics: PhysicsConfig;
};

/**
 * 기존 코드 const 값을 그대로 옮긴 기본값.
 * 게임 디자인 튜닝 시 GameplayConfigTable 의 physics 필드를 수정.
 */
export const defaultPhysicsConfig: PhysicsConfig = {
  subStepSize: 4,
  maxSubSteps: 32,
  pushOutEpsilon: 0.5,
  minAngleDeg: 15,
  barContactBias: 0.7,
};
