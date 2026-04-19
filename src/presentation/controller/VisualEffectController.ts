import type { GameplayConfig } from '../../definitions/types/GameplayConfig';
import type { IntroSequenceEntry } from '../../definitions/types/IntroSequenceEntry';
import type { GameplayEvent } from '../../gameplay/events/gameplayEvents';
import type { PresentationEvent } from '../events/presentationEvents';
import type { IntroPhase } from '../state/ScreenState';

/**
 * VisualEffectController — 시간 기반 시각 연출 타이머 관리.
 *
 * Gameplay 이벤트를 수신해 블록 피격 플래시 타이머와 바 파괴 타이머를 관리한다.
 * 또한 Intro 시퀀스의 typing/hold/erasing 단계 타이머를 진행한다.
 * ScreenDirector.update() 내부에서 호출되며, 각 getter 결과가 ScreenState에 반영된다.
 *
 * Unity 매핑: 순수 C# 클래스. MonoBehaviour 아님.
 * ScreenViewRoot MonoBehaviour 또는 GameplayRunner MonoBehaviour 에서 update() 를 호출한다.
 */
export class VisualEffectController {
  private readonly config: GameplayConfig;
  private readonly introPages: readonly IntroSequenceEntry[];

  /** blockId → 남은 플래시 시간(ms) */
  private readonly flashingBlocks: Map<string, number> = new Map();
  private barBreakRemainingMs: number = 0;

  // ---- Intro 시퀀스 내부 상태 ----
  private introActive: boolean = false;
  private introPageIndex: number = 0;
  private introPhase: IntroPhase = 'typing';
  private introPhaseElapsedMs: number = 0;
  /** IntroSequenceFinished 를 정확히 1회만 발행하기 위한 guard */
  private introFinishedEmitted: boolean = false;

  /**
   * @param config GameplayConfig — 타이머 파라미터 (블록 플래시, 바 파괴 등)
   * @param introPages IntroSequenceTable — intro 페이지 배열. 순서대로 진행됨.
   */
  constructor(config: GameplayConfig, introPages: readonly IntroSequenceEntry[]) {
    this.config = config;
    this.introPages = introPages;
  }

  // ────────────────────────────────────────────
  //  Intro 시퀀스
  // ────────────────────────────────────────────

  /**
   * startIntroSequence — Intro 시퀀스를 처음부터 시작(재시작)한다.
   * ScreenDirector 가 flowState.kind === 'introStory' 로 진입하는 첫 프레임에 호출한다.
   */
  startIntroSequence(): void {
    this.introActive = true;
    this.introPageIndex = 0;
    this.introPhase = 'typing';
    this.introPhaseElapsedMs = 0;
    this.introFinishedEmitted = false;
  }

  /** 현재 재생 중인 intro 페이지 인덱스 */
  getIntroPageIndex(): number {
    return this.introPageIndex;
  }

  /**
   * getIntroTypingProgress — 현재 페이지의 표시 진행률 (0~1).
   * - typing:  elapsed / (text.length * typingSpeedMs)
   * - hold:    항상 1
   * - erasing: 1 - elapsed / (text.length * eraseSpeedMs)
   * - done:    0
   */
  getIntroTypingProgress(): number {
    if (!this.introActive) return 0;
    const page = this.introPages[this.introPageIndex];
    if (page === undefined) return 0;

    switch (this.introPhase) {
      case 'typing': {
        const duration = page.text.length * page.typingSpeedMs;
        if (duration === 0) return 1;
        return Math.min(1, this.introPhaseElapsedMs / duration);
      }
      case 'hold':
        return 1;
      case 'erasing': {
        const duration = page.text.length * page.eraseSpeedMs;
        if (duration === 0) return 0;
        return Math.max(0, 1 - this.introPhaseElapsedMs / duration);
      }
      case 'done':
        return 0;
    }
  }

  /** 현재 페이지 내부 phase */
  getIntroPhase(): IntroPhase {
    return this.introPhase;
  }

  // ────────────────────────────────────────────
  //  Gameplay 이벤트 핸들러
  // ────────────────────────────────────────────

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

  // ────────────────────────────────────────────
  //  update
  // ────────────────────────────────────────────

  /**
   * update — 매 틱 타이머를 감소시킨다.
   *
   * - 블록 플래시 타이머 감소
   * - barBreakRemainingMs 감소 → 0 도달 시 LifeLostPresentationFinished 발행
   * - introActive 이면 페이지 타이머 진행
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
      this.barBreakRemainingMs -= deltaMs;
      if (this.barBreakRemainingMs <= 0) {
        this.barBreakRemainingMs = 0;
        emitPresentationEvent({ type: 'LifeLostPresentationFinished' });
      }
    }

    // Intro 시퀀스 타이머 진행
    if (this.introActive && this.introPhase !== 'done') {
      this.tickIntro(deltaMs, emitPresentationEvent);
    }
  }

  // ────────────────────────────────────────────
  //  내부 Intro 진행 로직
  // ────────────────────────────────────────────

  private tickIntro(
    deltaMs: number,
    emitPresentationEvent: (e: PresentationEvent) => void,
  ): void {
    const page = this.introPages[this.introPageIndex];
    if (page === undefined) {
      this.introPhase = 'done';
      return;
    }

    this.introPhaseElapsedMs += deltaMs;

    switch (this.introPhase) {
      case 'typing': {
        const typingDuration = page.text.length * page.typingSpeedMs;
        if (this.introPhaseElapsedMs >= typingDuration) {
          this.introPhase = 'hold';
          this.introPhaseElapsedMs = 0;
        }
        break;
      }
      case 'hold': {
        if (this.introPhaseElapsedMs >= page.holdDurationMs) {
          this.introPhase = 'erasing';
          this.introPhaseElapsedMs = 0;
        }
        break;
      }
      case 'erasing': {
        const eraseDuration = page.text.length * page.eraseSpeedMs;
        if (this.introPhaseElapsedMs >= eraseDuration) {
          // 다음 페이지로 진행하거나 시퀀스 완료
          if (this.introPageIndex < this.introPages.length - 1) {
            this.introPageIndex++;
            this.introPhase = 'typing';
            this.introPhaseElapsedMs = 0;
          } else {
            // 마지막 페이지 erasing 완료 → done
            this.introPhase = 'done';
            this.introPhaseElapsedMs = 0;
            if (!this.introFinishedEmitted) {
              this.introFinishedEmitted = true;
              emitPresentationEvent({ type: 'IntroSequenceFinished' });
            }
          }
        }
        break;
      }
      case 'done':
        // done 상태에서는 tickIntro 가 호출되지 않음 (update에서 guard)
        break;
    }
  }

  // ────────────────────────────────────────────
  //  기존 getter
  // ────────────────────────────────────────────

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
