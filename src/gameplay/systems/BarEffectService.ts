import type { BarState } from '../state/BarState';
import type { ItemDefinition } from '../../definitions/types/ItemDefinition';
import type { GameplayEvent } from '../events/gameplayEvents';

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

/** 자석 기본 지속시간 (ms). ItemDefinition.magnetDurationMs 없으면 이 값을 사용. */
const DEFAULT_MAGNET_DURATION_MS = 8000;

/** 확장 배율 기본값. ItemDefinition.expandMultiplier 없으면 이 값을 사용. */
const DEFAULT_EXPAND_MULTIPLIER = 1.5;

// ---------------------------------------------------------------------------
// 공개 타입
// ---------------------------------------------------------------------------

export type BarEffectApplyResult = {
  nextBar: BarState;
  nextMagnetRemaining: number;
  nextLaserCooldown: number;
  nextAttachedBalls: readonly string[];
  releasedBallIds: readonly string[];
  events: GameplayEvent[];
};

export type BarEffectTickResult = {
  nextMagnetRemaining: number;
  nextBar: BarState;
  releasedBallIds: readonly string[];
  events: GameplayEvent[];
};

export type BarEffectReleaseResult = {
  nextBar: BarState;
  releasedBallIds: readonly string[];
  events: GameplayEvent[];
};

// ---------------------------------------------------------------------------
// BarEffectService
// ---------------------------------------------------------------------------

/**
 * 바 효과 전환을 단일 경로로 관리하는 순수 서비스.
 *
 * 책임:
 * - 새 효과 적용 (기존 효과 정리 포함)
 * - 자석 타이머 tick (0 이하 도달 시 자동 해제)
 * - 자석 수동 해제
 *
 * 금지:
 * - 전역 상태, Math.random(), Date.now() 직접 사용
 * - Phaser / DOM 참조
 */
export class BarEffectService {
  constructor(private readonly itemDefinitions: Record<string, ItemDefinition>) {}

  // -------------------------------------------------------------------------
  // applyEffect
  // -------------------------------------------------------------------------

  /**
   * 새 효과를 적용한다. 기존 효과가 있으면 먼저 정리한다.
   *
   * @param currentBar          현재 바 상태
   * @param currentMagnetRemaining 현재 자석 남은 시간 (ms)
   * @param currentLaserCooldown   현재 레이저 쿨다운 (ms)
   * @param currentAttachedBalls   현재 부착 공 ID 목록
   * @param newItemType            획득한 아이템 종류
   * @param baseBarWidth           기본 바 너비 (확장/복원 기준)
   */
  applyEffect(
    currentBar: BarState,
    currentMagnetRemaining: number,
    currentLaserCooldown: number,
    currentAttachedBalls: readonly string[],
    newItemType: 'expand' | 'magnet' | 'laser',
    baseBarWidth: number,
  ): BarEffectApplyResult {
    const events: GameplayEvent[] = [];
    let releasedBallIds: readonly string[] = [];
    let nextMagnetRemaining = currentMagnetRemaining;
    let nextLaserCooldown = currentLaserCooldown;
    let nextAttachedBalls: readonly string[] = currentAttachedBalls;

    // --- 1. 기존 효과 정리 ---
    const prevEffect = currentBar.activeEffect;

    if (prevEffect === 'magnet' && currentAttachedBalls.length > 0) {
      // 자석 → 다른 효과: 부착 공 자동 발사 (replaced)
      releasedBallIds = [...currentAttachedBalls];
      nextAttachedBalls = [];
      nextMagnetRemaining = 0;
      events.push({
        type: 'BallsReleased',
        ballIds: releasedBallIds,
        releaseReason: 'replaced',
      });
    } else if (prevEffect === 'magnet') {
      nextMagnetRemaining = 0;
    } else if (prevEffect === 'laser') {
      nextLaserCooldown = 0;
    }

    // --- 2. 새 효과 적용 ---
    let nextBar: BarState;

    switch (newItemType) {
      case 'expand': {
        const itemDef = this.itemDefinitions['expand'];
        const multiplier = itemDef?.expandMultiplier ?? DEFAULT_EXPAND_MULTIPLIER;
        nextBar = {
          ...currentBar,
          width: baseBarWidth * multiplier,
          activeEffect: 'expand',
        };
        break;
      }

      case 'magnet': {
        const itemDef = this.itemDefinitions['magnet'];
        const duration = itemDef?.magnetDurationMs ?? DEFAULT_MAGNET_DURATION_MS;
        nextMagnetRemaining = duration;
        nextAttachedBalls = [];
        nextBar = {
          ...currentBar,
          width: baseBarWidth,
          activeEffect: 'magnet',
        };
        break;
      }

      case 'laser': {
        nextLaserCooldown = 0;
        nextBar = {
          ...currentBar,
          width: baseBarWidth,
          activeEffect: 'laser',
        };
        break;
      }
    }

    return {
      nextBar,
      nextMagnetRemaining,
      nextLaserCooldown,
      nextAttachedBalls,
      releasedBallIds,
      events,
    };
  }

  // -------------------------------------------------------------------------
  // tickMagnet
  // -------------------------------------------------------------------------

  /**
   * 자석 타이머를 dt만큼 감소시킨다.
   * 0 이하로 떨어지면 activeEffect를 'none'으로 전환하고 BallsReleased 이벤트를 발행한다.
   *
   * @param currentMagnetRemaining 현재 남은 자석 시간 (ms)
   * @param attachedBallIds        현재 부착 공 ID 목록
   * @param bar                    현재 바 상태
   * @param dt                     경과 시간 (ms 단위)
   */
  tickMagnet(
    currentMagnetRemaining: number,
    attachedBallIds: readonly string[],
    bar: BarState,
    dt: number,
  ): BarEffectTickResult {
    // 자석이 비활성이면 아무것도 하지 않는다
    if (bar.activeEffect !== 'magnet' || currentMagnetRemaining <= 0) {
      return {
        nextMagnetRemaining: currentMagnetRemaining,
        nextBar: bar,
        releasedBallIds: [],
        events: [],
      };
    }

    const nextMagnetRemaining = currentMagnetRemaining - dt;

    if (nextMagnetRemaining <= 0) {
      // 타임아웃: activeEffect 해제
      const nextBar: BarState = { ...bar, activeEffect: 'none' };
      const releasedBallIds = [...attachedBallIds];
      const events: GameplayEvent[] = [];

      if (releasedBallIds.length > 0) {
        events.push({
          type: 'BallsReleased',
          ballIds: releasedBallIds,
          releaseReason: 'timeout',
        });
      }

      return {
        nextMagnetRemaining: 0,
        nextBar,
        releasedBallIds,
        events,
      };
    }

    return {
      nextMagnetRemaining,
      nextBar: bar,
      releasedBallIds: [],
      events: [],
    };
  }

  // -------------------------------------------------------------------------
  // releaseManually
  // -------------------------------------------------------------------------

  /**
   * 스페이스 입력 등 수동 트리거로 자석 해제한다.
   * activeEffect를 'none'으로 전환하고 BallsReleased 이벤트를 발행한다.
   *
   * @param currentBar       현재 바 상태
   * @param attachedBallIds  현재 부착 공 ID 목록
   */
  releaseManually(
    currentBar: BarState,
    attachedBallIds: readonly string[],
  ): BarEffectReleaseResult {
    const nextBar: BarState = { ...currentBar, activeEffect: 'none' };
    const releasedBallIds = [...attachedBallIds];
    const events: GameplayEvent[] = [];

    if (releasedBallIds.length > 0) {
      events.push({
        type: 'BallsReleased',
        ballIds: releasedBallIds,
        releaseReason: 'space',
      });
    }

    return { nextBar, releasedBallIds, events };
  }
}
