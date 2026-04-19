import type { BarState } from '../state/BarState';
import type { BlockState } from '../state/BlockState';
import type { LaserShotState } from '../state/LaserShotState';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { GameplayEvent } from '../events/gameplayEvents';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 레이저 발사체 반너비 (px). AABB 충돌 검사에 사용. */
const LASER_HALF_W = 1;
/** 레이저 발사체 반높이 (px). AABB 충돌 검사에 사용. */
const LASER_HALF_H = 4;

/** 블록 너비 (px). CollisionService 상수와 동일하게 유지. */
const BLOCK_WIDTH = 64;
/** 블록 높이 (px). CollisionService 상수와 동일하게 유지. */
const BLOCK_HEIGHT = 24;

/** 바의 두께(절반값). 발사 위치 계산에 사용. */
const BAR_HALF_HEIGHT = 8;

/** 레이저 기본 수직 속도 (px/s). 음수 = 위쪽. */
const LASER_VY = -1200;

/** 레이저 기본 쿨타임 (ms). ItemDefinition.laserCooldownMs 없으면 이 값을 사용. */
const DEFAULT_LASER_COOLDOWN_MS = 400;

// ---------------------------------------------------------------------------
// LaserSystem
// ---------------------------------------------------------------------------

/**
 * 레이저 효과 전담 시스템.
 *
 * 책임:
 * - fireLaser: FireLaser 커맨드에 응답해 2발 생성 및 쿨다운 설정
 * - tick: 매 틱마다 발사체 이동 및 쿨다운 감소, 천장 통과 발사체 제거
 * - handleBlockCollisions: 레이저 ↔ 블록 AABB 충돌, shot 소멸, 블록 피격 처리
 *
 * 금지:
 * - Date.now(), Math.random() 직접 사용
 * - 전역 상태
 * - Phaser / DOM 참조
 */
export class LaserSystem {
  constructor(private readonly nextId: () => string) {}

  // -------------------------------------------------------------------------
  // fireLaser
  // -------------------------------------------------------------------------

  /**
   * FireLaser 커맨드 처리: 바 좌우에서 2발 생성, 쿨다운 설정, LaserFired 이벤트 발행.
   *
   * @param currentBar       현재 바 상태 (위치/너비)
   * @param currentShots     현재 화면의 레이저 발사체 목록
   * @param laserCooldownMs  ItemDefinition.laserCooldownMs 값 (없으면 기본값 사용)
   */
  fireLaser(
    currentBar: BarState,
    currentShots: readonly LaserShotState[],
    laserCooldownMs: number | undefined,
  ): {
    newShots: readonly LaserShotState[];
    nextCooldownMs: number;
    events: GameplayEvent[];
  } {
    const spawnY = currentBar.y - BAR_HALF_HEIGHT;
    const offsetX = currentBar.width / 3;

    const shot1: LaserShotState = {
      id: this.nextId(),
      x: currentBar.x - offsetX,
      y: spawnY,
      vy: LASER_VY,
    };
    const shot2: LaserShotState = {
      id: this.nextId(),
      x: currentBar.x + offsetX,
      y: spawnY,
      vy: LASER_VY,
    };

    const cooldown = laserCooldownMs ?? DEFAULT_LASER_COOLDOWN_MS;

    return {
      newShots: [...currentShots, shot1, shot2],
      nextCooldownMs: cooldown,
      events: [{ type: 'LaserFired', shotCount: 2 }],
    };
  }

  // -------------------------------------------------------------------------
  // tick
  // -------------------------------------------------------------------------

  /**
   * 매 틱: 발사체 이동(y += vy * dt), 천장 통과 시 제거, 쿨다운 감소.
   *
   * @param shots       현재 발사체 목록
   * @param cooldownMs  현재 쿨다운 잔여 시간 (ms)
   * @param dt          경과 시간 (초)
   */
  tick(
    shots: readonly LaserShotState[],
    cooldownMs: number,
    dt: number,
  ): {
    nextShots: readonly LaserShotState[];
    nextCooldownMs: number;
  } {
    const dtMs = dt * 1000;

    const nextShots = shots
      .map((s) => ({ ...s, y: s.y + s.vy * dt }))
      // 천장(y < 0) 통과 시 제거: 발사체 상단(y - LASER_HALF_H)이 0 미만
      .filter((s) => s.y - LASER_HALF_H >= 0);

    const nextCooldownMs = Math.max(0, cooldownMs - dtMs);

    return { nextShots, nextCooldownMs };
  }

  // -------------------------------------------------------------------------
  // handleBlockCollisions
  // -------------------------------------------------------------------------

  /**
   * 레이저 ↔ 블록 AABB 충돌 처리.
   *
   * - 각 shot에 대해 첫 번째로 겹치는 non-destroyed 블록을 찾는다.
   * - shot은 첫 블록 hit 시 소멸한다 (관통 없음).
   * - 블록은 remainingHits -= 1; 0 이하면 파괴.
   * - BlockHit / BlockDestroyed 이벤트 발행.
   *
   * @param shots            현재 발사체 목록
   * @param blocks           현재 블록 목록
   * @param blockDefinitions 블록 정의 테이블 (점수 조회용)
   */
  handleBlockCollisions(
    shots: readonly LaserShotState[],
    blocks: readonly BlockState[],
    blockDefinitions: Record<string, BlockDefinition>,
  ): {
    nextShots: readonly LaserShotState[];
    nextBlocks: readonly BlockState[];
    events: GameplayEvent[];
    destroyedBlockIds: readonly string[];
    scoreDelta: number;
  } {
    const events: GameplayEvent[] = [];
    const destroyedBlockIds: string[] = [];
    let totalScoreDelta = 0;

    // 불변 처리를 위해 blocks 변경 사항을 Map으로 추적한다
    const blockUpdates = new Map<string, BlockState>();
    const removedShotIds = new Set<string>();

    for (const shot of shots) {
      if (removedShotIds.has(shot.id)) continue;

      // y가 이미 0 미만인 shot은 tick에서 제거됐어야 하지만 방어적으로 건너뜀
      // 각 shot에 대해 hit 가능한 첫 블록을 찾는다
      let hitBlock: BlockState | undefined;

      for (const block of blocks) {
        // blockUpdates에서 최신 상태 가져옴 (같은 틱에 이미 처리된 블록 반영)
        const currentBlock = blockUpdates.get(block.id) ?? block;
        if (currentBlock.isDestroyed) continue;

        if (this.shotOverlapsBlock(shot, currentBlock)) {
          hitBlock = currentBlock;
          break;
        }
      }

      if (!hitBlock) continue;

      // shot 소멸
      removedShotIds.add(shot.id);

      // 블록 remainingHits 감소
      const newRemainingHits = hitBlock.remainingHits - 1;

      if (newRemainingHits <= 0) {
        const destroyed: BlockState = {
          ...hitBlock,
          remainingHits: 0,
          isDestroyed: true,
        };
        blockUpdates.set(hitBlock.id, destroyed);
        destroyedBlockIds.push(hitBlock.id);

        const def = blockDefinitions[hitBlock.definitionId];
        const scoreDelta = def ? def.score : 0;
        totalScoreDelta += scoreDelta;
        events.push({ type: 'BlockDestroyed', blockId: hitBlock.id, scoreDelta });
      } else {
        const damaged: BlockState = {
          ...hitBlock,
          remainingHits: newRemainingHits,
        };
        blockUpdates.set(hitBlock.id, damaged);
        events.push({ type: 'BlockHit', blockId: hitBlock.id, remainingHits: newRemainingHits });
      }
    }

    const nextShots = shots.filter((s) => !removedShotIds.has(s.id));
    const nextBlocks = blocks.map((b) => blockUpdates.get(b.id) ?? b);

    return {
      nextShots,
      nextBlocks,
      events,
      destroyedBlockIds,
      scoreDelta: totalScoreDelta,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * 레이저 발사체와 블록의 AABB 겹침 여부를 반환한다.
   * 발사체는 2*LASER_HALF_W × 2*LASER_HALF_H 크기의 작은 AABB로 취급한다.
   * 블록은 BLOCK_WIDTH × BLOCK_HEIGHT 크기 (좌상단 기준 x, y).
   */
  private shotOverlapsBlock(shot: LaserShotState, block: BlockState): boolean {
    const shotLeft = shot.x - LASER_HALF_W;
    const shotRight = shot.x + LASER_HALF_W;
    const shotTop = shot.y - LASER_HALF_H;
    const shotBottom = shot.y + LASER_HALF_H;

    const blockLeft = block.x;
    const blockRight = block.x + BLOCK_WIDTH;
    const blockTop = block.y;
    const blockBottom = block.y + BLOCK_HEIGHT;

    return (
      shotLeft < blockRight &&
      shotRight > blockLeft &&
      shotTop < blockBottom &&
      shotBottom > blockTop
    );
  }
}
