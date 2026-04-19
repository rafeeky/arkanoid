/**
 * SpinnerSystem
 *
 * 책임:
 * - tick: 매 틱 모든 spinnerStates 업데이트 (3-phase 이동 + 자체 회전)
 * - handleBallCollisions: phase='circling'인 spinner만 공 충돌 감지 (spawning/descending은 ghost)
 * - handleBlockCollisions: phase='circling'인 spinner만 블록 충돌 감지
 *
 * Phase 설계:
 *   'spawning'   → gate 열림 연출 400ms. y=0 고정. ghost.
 *   'descending' → 선형 하강 80 px/s. y=0 → descentEndY. x=spawnX. ghost.
 *   'circling'   → 원 궤도 1.5 rad/s, 반지름 150. solid.
 *
 * 원 근사 설계 결정:
 * - 정육면체/삼각형 모두 size/2 반지름의 원으로 처리한다.
 * - 기하 정확도보다 신뢰성과 이식성(Unity 포팅)을 우선한다.
 * - 반사 법선은 공 중심 → 회전체 중심 방향의 역벡터.
 *
 * phase-gate (블록 충돌):
 * - (angleRad mod 2π) 와 blockCollisionPhases 각 항목의 각도 차이가
 *   PHASE_TOLERANCE(±0.1 rad) 이내면 블록 충돌 활성.
 * - 활성 시 회전체 중심에서 SPINNER_BLOCK_REACH 이내 블록에 1 데미지.
 *
 * 금지:
 * - Date.now(), Math.random() 직접 사용
 * - 전역 상태 / 싱글톤
 * - Phaser / DOM 참조
 */

import type { SpinnerRuntimeState } from '../state/SpinnerRuntimeState';
import type { BallState } from '../state/BallState';
import type { BlockState } from '../state/BlockState';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { GameplayEvent } from '../events/gameplayEvents';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 공 반지름 (px). CollisionService 상수와 동일하게 유지. */
const BALL_RADIUS = 8;

/** 회전체-블록 충돌 phase 허용 오차 (rad). 약 ±5.7°. */
const PHASE_TOLERANCE = 0.1;

/** 블록 너비 (px). CollisionService 상수와 동일하게 유지. */
const BLOCK_WIDTH = 64;

/** 블록 높이 (px). CollisionService 상수와 동일하게 유지. */
const BLOCK_HEIGHT = 24;

/** 블록 대각선 반 길이 (px). 회전체-블록 거리 검사에 사용. */
const BLOCK_HALF_DIAG = Math.sqrt((BLOCK_WIDTH / 2) ** 2 + (BLOCK_HEIGHT / 2) ** 2);

/** gate 열림 연출 지속 시간 (ms). */
export const SPAWN_DURATION_MS = 400;

/** descending phase 하강 속도 (px/s). */
export const DESCENT_SPEED_PX_PER_SEC = 80;

/** circling phase 원 반지름 (px). */
export const CIRCLE_RADIUS = 60;

/** circling phase 원 궤도 회전 속도 (rad/s). */
export const CIRCLE_SPEED_RAD_PER_SEC = 1.5;

// ---------------------------------------------------------------------------
// SpinnerSystem
// ---------------------------------------------------------------------------

export class SpinnerSystem {
  constructor(private readonly spinnerDefinitions: Record<string, SpinnerDefinition>) {}

  // -------------------------------------------------------------------------
  // tick
  // -------------------------------------------------------------------------

  /**
   * 매 틱: 모든 spinnerStates 업데이트.
   *
   * 자체 회전(angleRad)은 모든 phase에서 계속 증가한다.
   * phase 분기: spawning → descending → circling
   *
   * @param spinnerStates 현재 회전체 상태 목록
   * @param dt            경과 시간 (초)
   */
  tick(
    spinnerStates: readonly SpinnerRuntimeState[],
    dt: number,
  ): readonly SpinnerRuntimeState[] {
    return spinnerStates.map((s) => {
      const def = this.spinnerDefinitions[s.definitionId];
      if (!def) return s;

      // 자체 회전은 모든 phase에서 항상 업데이트
      const newAngleRad = normalizeAngle(s.angleRad + def.rotationSpeedRadPerSec * dt);

      switch (s.phase) {
        case 'spawning':
          return this.tickSpawning({ ...s, angleRad: newAngleRad }, dt);

        case 'descending':
          return this.tickDescending({ ...s, angleRad: newAngleRad }, dt);

        case 'circling':
          return this.tickCircling({ ...s, angleRad: newAngleRad }, dt);
      }
    });
  }

  // -------------------------------------------------------------------------
  // handleBallCollisions
  // -------------------------------------------------------------------------

  /**
   * 공 ↔ 회전체 충돌 검사 및 반사.
   * phase='circling'인 spinner만 처리한다. spawning/descending은 ghost 취급.
   * 원 근사: 회전체를 size/2 반지름 원으로 취급.
   * 공이 여러 회전체와 겹칠 경우 가장 가까운 하나만 처리한다.
   *
   * @param ball          현재 공 상태
   * @param spinnerStates 현재 회전체 상태 목록
   */
  handleBallCollisions(
    ball: BallState,
    spinnerStates: readonly SpinnerRuntimeState[],
  ): {
    nextBall: BallState;
    collided: boolean;
  } {
    if (!ball.isActive || spinnerStates.length === 0) {
      return { nextBall: ball, collided: false };
    }

    // phase='circling'인 spinner만 대상으로 한다
    const activeSpinners = spinnerStates.filter((s) => s.phase === 'circling');
    if (activeSpinners.length === 0) {
      return { nextBall: ball, collided: false };
    }

    // 가장 가까운 겹침 회전체를 찾는다
    let closestSpinner: SpinnerRuntimeState | undefined;
    let closestDist = Infinity;

    for (const s of activeSpinners) {
      const def = this.spinnerDefinitions[s.definitionId];
      if (!def) continue;

      const spinnerRadius = def.size / 2;
      const combinedRadius = spinnerRadius + BALL_RADIUS;
      const dist = distance(ball.x, ball.y, s.x, s.y);

      if (dist < combinedRadius && dist < closestDist) {
        closestDist = dist;
        closestSpinner = s;
      }
    }

    if (!closestSpinner) {
      return { nextBall: ball, collided: false };
    }

    const def = this.spinnerDefinitions[closestSpinner.definitionId];
    if (!def) return { nextBall: ball, collided: false };

    const spinnerRadius = def.size / 2;
    const combinedRadius = spinnerRadius + BALL_RADIUS;

    // 반사 법선: 회전체 중심 → 공 방향 (공이 회전체 밖으로 나가는 방향)
    const dx = ball.x - closestSpinner.x;
    const dy = ball.y - closestSpinner.y;
    const dist = closestDist;

    let nx: number;
    let ny: number;

    if (dist < 1e-6) {
      // 공 중심이 회전체 중심과 거의 겹치는 극단적 케이스 → 위 방향으로 튕김
      nx = 0;
      ny = -1;
    } else {
      nx = dx / dist;
      ny = dy / dist;
    }

    // 입사 속도의 법선 성분
    const dot = ball.vx * nx + ball.vy * ny;

    // 이미 분리 방향(dot > 0)이면 반사 불필요 — 관통 방지만 적용
    if (dot >= 0) {
      // 분리만 수행 (속도 유지)
      const overlap = combinedRadius - dist;
      const nextBall: BallState = {
        ...ball,
        x: ball.x + nx * overlap,
        y: ball.y + ny * overlap,
      };
      return { nextBall, collided: true };
    }

    // 반사: v' = v - 2(v·n)n
    const newVx = ball.vx - 2 * dot * nx;
    const newVy = ball.vy - 2 * dot * ny;

    // 겹침 해소: 공을 결합 반지름 경계로 밀어낸다
    const overlap = combinedRadius - dist;
    const nextBall: BallState = {
      ...ball,
      x: ball.x + nx * overlap,
      y: ball.y + ny * overlap,
      vx: newVx,
      vy: newVy,
    };

    return { nextBall, collided: true };
  }

  // -------------------------------------------------------------------------
  // handleBlockCollisions
  // -------------------------------------------------------------------------

  /**
   * 회전체 ↔ 블록 phase-gate 충돌.
   * phase='circling'인 spinner만 처리한다. spawning/descending은 ghost 취급.
   *
   * 각 spinnerState에 대해:
   * 1. 현재 angleRad(2π 정규화)가 blockCollisionPhases 중 하나와 ±PHASE_TOLERANCE 이내인지 확인
   * 2. 활성 시 회전체 중심으로부터 (size/2 + BLOCK_HALF_DIAG) 이내 블록을 찾는다
   * 3. 겹치면 블록 remainingHits -= 1; 0 이하면 파괴
   * 4. BlockHit / BlockDestroyed 이벤트 발행
   *
   * 같은 틱에 여러 회전체가 같은 블록을 타격할 수 있다 (독립 처리).
   *
   * @param spinnerStates    현재 회전체 상태 목록
   * @param blocks           현재 블록 목록
   * @param blockDefinitions 블록 정의 테이블 (점수 조회용)
   */
  handleBlockCollisions(
    spinnerStates: readonly SpinnerRuntimeState[],
    blocks: readonly BlockState[],
    blockDefinitions: Record<string, BlockDefinition>,
  ): {
    nextBlocks: readonly BlockState[];
    events: GameplayEvent[];
    scoreDelta: number;
  } {
    if (spinnerStates.length === 0 || blocks.length === 0) {
      return { nextBlocks: blocks, events: [], scoreDelta: 0 };
    }

    // phase='circling'인 spinner만 대상으로 한다
    const activeSpinners = spinnerStates.filter((s) => s.phase === 'circling');
    if (activeSpinners.length === 0) {
      return { nextBlocks: blocks, events: [], scoreDelta: 0 };
    }

    const events: GameplayEvent[] = [];
    let totalScoreDelta = 0;

    // 불변 처리: 블록 변경 사항을 Map으로 추적
    const blockUpdates = new Map<string, BlockState>();

    for (const s of activeSpinners) {
      const def = this.spinnerDefinitions[s.definitionId];
      if (!def) continue;

      // phase 활성 여부 확인
      if (!this.isPhaseActive(s.angleRad, def.blockCollisionPhases)) continue;

      // 회전체 충돌 도달 거리: 회전체 외접원 반지름 + 블록 대각선 반 길이
      const reachDist = def.size / 2 + BLOCK_HALF_DIAG;

      for (const block of blocks) {
        const currentBlock = blockUpdates.get(block.id) ?? block;
        if (currentBlock.isDestroyed) continue;

        // 블록 중심
        const blockCenterX = currentBlock.x + BLOCK_WIDTH / 2;
        const blockCenterY = currentBlock.y + BLOCK_HEIGHT / 2;

        const dist = distance(s.x, s.y, blockCenterX, blockCenterY);
        if (dist > reachDist) continue;

        // 실제 AABB 겹침 확인: spinner 원과 블록 AABB
        const spinnerRadius = def.size / 2;
        if (!circleOverlapsRect(s.x, s.y, spinnerRadius, currentBlock)) continue;

        // 블록 데미지 처리
        const newRemainingHits = currentBlock.remainingHits - 1;

        if (newRemainingHits <= 0) {
          const destroyed: BlockState = {
            ...currentBlock,
            remainingHits: 0,
            isDestroyed: true,
          };
          blockUpdates.set(currentBlock.id, destroyed);

          const blockDef = blockDefinitions[currentBlock.definitionId];
          const scoreDelta = blockDef ? blockDef.score : 0;
          totalScoreDelta += scoreDelta;
          events.push({ type: 'BlockDestroyed', blockId: currentBlock.id, scoreDelta });
        } else {
          const damaged: BlockState = {
            ...currentBlock,
            remainingHits: newRemainingHits,
          };
          blockUpdates.set(currentBlock.id, damaged);
          events.push({
            type: 'BlockHit',
            blockId: currentBlock.id,
            remainingHits: newRemainingHits,
          });
        }
      }
    }

    const nextBlocks = blocks.map((b) => blockUpdates.get(b.id) ?? b);
    return { nextBlocks, events, scoreDelta: totalScoreDelta };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * spawning phase 틱: spawnElapsedMs 진행. SPAWN_DURATION_MS 초과 시 descending 전환.
   * x, y 불변 (y=0, x=spawnX 유지).
   */
  private tickSpawning(s: SpinnerRuntimeState, dt: number): SpinnerRuntimeState {
    const newElapsedMs = s.spawnElapsedMs + dt * 1000;

    if (newElapsedMs >= SPAWN_DURATION_MS) {
      return {
        ...s,
        phase: 'descending',
        spawnElapsedMs: SPAWN_DURATION_MS,
        x: s.spawnX,
        y: 0,
      };
    }

    return {
      ...s,
      spawnElapsedMs: newElapsedMs,
      x: s.spawnX,
      y: 0,
    };
  }

  /**
   * descending phase 틱: 선형 하강 (80 px/s).
   * y >= descentEndY 도달 시 circling 전환.
   * x = spawnX 고정.
   */
  private tickDescending(s: SpinnerRuntimeState, dt: number): SpinnerRuntimeState {
    const newY = s.y + DESCENT_SPEED_PX_PER_SEC * dt;

    if (newY >= s.descentEndY) {
      return {
        ...s,
        phase: 'circling',
        x: s.spawnX,
        y: s.descentEndY,
        circleAngleRad: -Math.PI / 2, // 원 궤도 상단(위쪽)에서 시작
      };
    }

    return {
      ...s,
      x: s.spawnX,
      y: newY,
    };
  }

  /**
   * circling phase 틱: 원 궤도 이동.
   * circleAngleRad += CIRCLE_SPEED_RAD_PER_SEC * dt
   * x = circleCenterX + circleRadius * cos(circleAngleRad)
   * y = circleCenterY + circleRadius * sin(circleAngleRad)
   */
  private tickCircling(s: SpinnerRuntimeState, dt: number): SpinnerRuntimeState {
    const newCircleAngle = s.circleAngleRad + CIRCLE_SPEED_RAD_PER_SEC * dt;
    const newX = s.circleCenterX + s.circleRadius * Math.cos(newCircleAngle);
    const newY = s.circleCenterY + s.circleRadius * Math.sin(newCircleAngle);

    return {
      ...s,
      circleAngleRad: newCircleAngle,
      x: newX,
      y: newY,
    };
  }

  /**
   * 현재 각도가 phase 허용 범위 안에 있는지 확인한다.
   * 각도 차이는 2π 주기로 정규화해서 비교한다.
   */
  private isPhaseActive(
    angleRad: number,
    phases: readonly number[],
  ): boolean {
    const normalized = normalizeAngle(angleRad);
    for (const phase of phases) {
      const normalizedPhase = normalizeAngle(phase);
      const diff = angleDiff(normalized, normalizedPhase);
      if (diff <= PHASE_TOLERANCE) return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * 각도를 [0, 2π) 범위로 정규화한다.
 */
export function normalizeAngle(rad: number): number {
  const TWO_PI = 2 * Math.PI;
  return ((rad % TWO_PI) + TWO_PI) % TWO_PI;
}

/**
 * 두 각도 사이의 최소 절대 차이 (0 ~ π 범위).
 */
function angleDiff(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a - b));
  return diff > Math.PI ? 2 * Math.PI - diff : diff;
}

/**
 * 두 점 사이의 유클리드 거리.
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 원 vs AABB 겹침 검사.
 * 블록은 (block.x, block.y) 좌상단 기준 BLOCK_WIDTH × BLOCK_HEIGHT 크기.
 */
function circleOverlapsRect(
  cx: number,
  cy: number,
  radius: number,
  block: { x: number; y: number },
): boolean {
  const blockLeft = block.x;
  const blockRight = block.x + BLOCK_WIDTH;
  const blockTop = block.y;
  const blockBottom = block.y + BLOCK_HEIGHT;

  // 원 중심에서 AABB 가장 가까운 점까지의 거리 계산
  const nearestX = Math.max(blockLeft, Math.min(cx, blockRight));
  const nearestY = Math.max(blockTop, Math.min(cy, blockBottom));

  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}
