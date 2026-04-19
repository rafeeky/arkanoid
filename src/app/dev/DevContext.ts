/**
 * DevContext.ts — 개발 관측 도구 컨텍스트.
 *
 * DevContext는 AppContext에 선택적으로 주입된다.
 * devContext가 undefined이거나 isEnabled === false이면 AppContext의 dev hooks가
 * 완전히 스킵되어 production 빌드에 오버헤드가 없다.
 *
 * Unity 매핑: DebugOverlayManager (MonoBehaviour) 가 보유할 context 구조에 해당.
 *             Editor 또는 Development Build 에서만 활성화된다.
 */

import { DefaultInvariantChecker } from './InvariantChecker';
import type { IInvariantChecker } from './InvariantChecker';
import { ReplayRecorder } from './ReplayRecorder';
import { CollisionLog } from './CollisionLog';
import { BallTrail } from './BallTrail';

export type { IInvariantChecker };
export { ReplayRecorder, CollisionLog, BallTrail };

/**
 * DevContext: Dev 모드에서 사용할 관측 도구 묶음.
 *
 * isEnabled: F1 토글 상태. false이면 AppContext가 dev hooks를 완전 스킵.
 * invariantChecker: 매 틱 후 invariant 검증 (IInvariantChecker 인터페이스).
 * replayRecorder: 입력 스트림 녹화.
 * collisionLog: 최근 충돌 이벤트 저장.
 * ballTrail: 공 최근 N 좌표.
 */
export type DevContext = {
  isEnabled: boolean;
  invariantChecker: IInvariantChecker;
  replayRecorder: ReplayRecorder;
  collisionLog: CollisionLog;
  ballTrail: BallTrail;
};

/**
 * createDevContext: DevContext를 기본 설정으로 생성한다.
 *
 * @param seed RNG 시드. MVP1에서는 RNG 미사용이지만 향후 결정론적 재현을 위해 예약.
 * @param initialStageIndex 세션 시작 스테이지 인덱스 (기본 0).
 *
 * 기본값:
 * - isEnabled: true (생성 시점에 dev 모드 ON)
 * - invariantChecker: DefaultInvariantChecker
 * - replayRecorder: maxFrames 10000 (약 160초 @ 60fps)
 * - collisionLog: maxSize 10
 * - ballTrail: maxLength 30
 */
export function createDevContext(seed: number, initialStageIndex: number = 0): DevContext {
  return {
    isEnabled: true,
    invariantChecker: new DefaultInvariantChecker(),
    replayRecorder: new ReplayRecorder(seed, initialStageIndex),
    collisionLog: new CollisionLog(10),
    ballTrail: new BallTrail(30),
  };
}

/**
 * createNoopDevContext — Dev 기능이 비활성화된 no-op DevContext를 생성한다.
 *
 * production 빌드 또는 dev 파라미터 없는 실행 시 사용.
 * AppContext에 devContext를 주입하지 않는 것이 권장되지만,
 * 테스트에서 devContext 유무 분기를 검증할 때 활용할 수 있다.
 */
export function createNoopDevContext(): DevContext {
  return {
    isEnabled: false,
    invariantChecker: new DefaultInvariantChecker(),
    replayRecorder: new ReplayRecorder(0),
    collisionLog: new CollisionLog(1),
    ballTrail: new BallTrail(1),
  };
}
