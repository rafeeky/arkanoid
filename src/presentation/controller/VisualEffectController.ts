import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { GameplayEvent } from '../../gameplay/events/gameplayEvents';
import type { PresentationEvent } from '../events/presentationEvents';

/**
 * VisualEffectController — 시간 기반 시각 연출 타이머 관리.
 *
 * Gameplay 이벤트를 수신해 블록 피격 플래시 타이머와 바 파괴 타이머를 관리한다.
 * ScreenDirector.update() 내부에서 호출되며, getFlashingBlockIds() / isBarBreaking()
 * 결과가 ScreenState에 반영된다.
 *
 * Unity 매핑: 순수 C# 클래스. MonoBehaviour 아님.
 * ScreenViewRoot MonoBehaviour 또는 GameplayRunner MonoBehaviour 에서 update() 를 호출한다.
 */
export class VisualEffectController {
  private readonly config: GameplayConfig;
  /** blockId → 남은 플래시 시간(ms) */
  private readonly flashingBlocks: Map<string, number> = new Map();
  private barBreakRemainingMs: number = 0;

  constructor(config: GameplayConfig) {
    this.config = config;
  }

  /**
   * handleGameplayEvent — Gameplay 이벤트를 수신해 타이머를 설정한다.
   * - BlockHit: 해당 블록에 플래시 타이머 설정
   * - BlockDestroyed: 블록이 사라지므로 플래시 타이머 제거
   * - LifeLost: 바 파괴 타이머 설정
   */
  handleGameplayEvent(event: GameplayEvent): void {
    if (event.type === 'BlockHit') {
      this.flashingBlocks.set(event.blockId, this.config.blockHitFlashDurationMs);
    } else if (event.type === 'BlockDestroyed') {
      this.flashingBlocks.delete(event.blockId);
    } else if (event.type === 'LifeLost') {
      this.barBreakRemainingMs = this.config.barBreakDurationMs;
    }
  }

  /**
   * update — 매 틱 타이머를 감소시킨다.
   * barBreakRemainingMs 가 이번 틱에 0 이하로 내려가면 LifeLostPresentationFinished 를 발행한다.
   * (직전 틱은 >0, 이번 틱은 <=0 인 경우만 1회 발행 — 경계 감지)
   */
  update(
    deltaMs: number,
    emitPresentationEvent: (e: PresentationEvent) => void,
  ): void {
    // 블록 플래시 타이머 감소
    for (const [id, remaining] of this.flashingBlocks) {
      const next = remaining - deltaMs;
      if (next <= 0) {
        this.flashingBlocks.delete(id);
      } else {
        this.flashingBlocks.set(id, next);
      }
    }

    // 바 파괴 타이머 감소 + 경계 감지
    if (this.barBreakRemainingMs > 0) {
      const prev = this.barBreakRemainingMs;
      this.barBreakRemainingMs -= deltaMs;
      if (this.barBreakRemainingMs <= 0) {
        this.barBreakRemainingMs = 0;
        // prev > 0 이고 now <= 0: 정확히 이번 틱에 완료됨
        void prev; // 명시적으로 사용 (경계 감지 조건은 위의 if 로 충분)
        emitPresentationEvent({ type: 'LifeLostPresentationFinished' });
      }
    }
  }

  /** 현재 플래시 중인 블록 ID 목록 */
  getFlashingBlockIds(): readonly string[] {
    return Array.from(this.flashingBlocks.keys());
  }

  /** 바 파괴 연출 진행 중 여부 */
  isBarBreaking(): boolean {
    return this.barBreakRemainingMs > 0;
  }

  /**
   * getBarBreakProgress — 0.0(완료) ~ 1.0(시작) 진행도.
   * 렌더링에서 opacity/scale 애니메이션에 사용한다.
   * barBreakDurationMs = 0 이면 0.0 반환.
   */
  getBarBreakProgress(): number {
    if (this.config.barBreakDurationMs === 0) return 0;
    const ratio = this.barBreakRemainingMs / this.config.barBreakDurationMs;
    return Math.max(0, Math.min(1, ratio));
  }
}
