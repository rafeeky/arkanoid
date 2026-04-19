import Phaser from 'phaser';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';
import type { GameFlowState } from '../../flow/state/GameFlowState';
import type { DevContext } from '../../app/dev/DevContext';
import type { CollisionLogEntry } from '../../app/dev/CollisionLog';

/**
 * DevOverlayRenderer — 개발 전용 오버레이 렌더러.
 *
 * DevContext.isEnabled 가 false 이면 모든 오브젝트를 숨긴다.
 * isEnabled 가 true 이면 다음을 그린다:
 *   1. 반투명 배경 (캔버스 전체에 살짝 어둡게)
 *   2. 블록 ID 텍스트 (non-destroyed 블록 위에 'block_37' 형태)
 *   3. 공 trail (ballTrail.getPoints() 연결선, 오래된 점은 투명)
 *   4. 최근 충돌 로그 (우측 상단 5줄)
 *   5. 현재 공 vx, vy 수치 표시
 *   6. Flow 상태 + tickIndex
 *   7. MVP3 활성 효과 패널 (좌하단 — Phase 2 전까지 자리 확보용 '--' 표시)
 *
 * 풀(Pool) 패턴:
 *   - 블록 ID 텍스트는 construction 시 BLOCK_POOL_SIZE 개를 미리 생성.
 *     render() 에서 visible/text/position 갱신만 수행. GC 압박 없음.
 *   - Graphics 는 1개를 재사용하여 매 프레임 clear() + 재드로우.
 *
 * Unity 매핑: DebugOverlayView MonoBehaviour. #if DEVELOPMENT_BUILD 또는
 *             Editor 전용 GameObject 에 붙는 형태. OnGUI 또는 Debug UI Canvas 에 해당.
 */

// 블록 텍스트 풀 크기 — Stage 1 최대 블록(약 80개) + 여유분
const BLOCK_POOL_SIZE = 128;

// 충돌 로그 표시 줄 수
const COLLISION_LOG_LINES = 5;

// Trail 선 색상 (시작 alpha → 끝 alpha 그라데이션은 Graphics로 처리)
const TRAIL_COLOR = 0x00ffff;
const TRAIL_ALPHA_START = 0.6;
const TRAIL_ALPHA_END = 0.05;

// 텍스트 공통 스타일
const TEXT_STYLE_BLOCK_ID: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: '10px',
  color: '#00ffff',
  fontFamily: 'monospace',
  backgroundColor: 'rgba(0,0,0,0.4)',
};

const TEXT_STYLE_HUD: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: '12px',
  color: '#00ff88',
  fontFamily: 'monospace',
  backgroundColor: 'rgba(0,0,0,0.6)',
};

export class DevOverlayRenderer {
  private readonly scene: Phaser.Scene;

  // 반투명 배경 (전체 캔버스)
  private readonly dimOverlay: Phaser.GameObjects.Rectangle;

  // 블록 ID 텍스트 풀
  private readonly blockIdPool: Phaser.GameObjects.Text[];

  // 공 trail 그래픽스
  private readonly trailGraphics: Phaser.GameObjects.Graphics;

  // 충돌 로그 텍스트 (우측 상단)
  private readonly collisionLogTexts: Phaser.GameObjects.Text[];

  // 공 velocity 텍스트
  private readonly ballVelocityText: Phaser.GameObjects.Text;

  // Flow 상태 + tick 텍스트
  private readonly flowStateText: Phaser.GameObjects.Text;

  // MVP3 활성 효과 패널 (좌하단)
  // TODO(mvp3): MVP3 Phase 2 에서 RuntimeState 에 activeEffect/magnet/laser/spinner 필드가 추가되면
  // 여기 defensive read 대신 실제 값을 연결할 것.
  private readonly mvp3EffectPanelText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // 반투명 배경 — 전체 캔버스 크기. depth 를 높여 게임 오브젝트 위에 렌더링.
    const { width, height } = scene.scale;
    this.dimOverlay = scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.25)
      .setDepth(100)
      .setVisible(false);

    // 블록 ID 텍스트 풀
    this.blockIdPool = [];
    for (let i = 0; i < BLOCK_POOL_SIZE; i++) {
      const t = scene.add
        .text(0, 0, '', TEXT_STYLE_BLOCK_ID)
        .setOrigin(0.5, 0.5)
        .setDepth(102)
        .setVisible(false);
      this.blockIdPool.push(t);
    }

    // Trail Graphics
    this.trailGraphics = scene.add.graphics().setDepth(101).setVisible(false);

    // 충돌 로그 텍스트
    this.collisionLogTexts = [];
    for (let i = 0; i < COLLISION_LOG_LINES; i++) {
      const t = scene.add
        .text(width - 8, 8 + i * 16, '', TEXT_STYLE_HUD)
        .setOrigin(1, 0)
        .setDepth(103)
        .setVisible(false);
      this.collisionLogTexts.push(t);
    }

    // Ball velocity 텍스트
    this.ballVelocityText = scene.add
      .text(8, height - 48, '', TEXT_STYLE_HUD)
      .setOrigin(0, 1)
      .setDepth(103)
      .setVisible(false);

    // Flow 상태 텍스트
    this.flowStateText = scene.add
      .text(8, height - 30, '', TEXT_STYLE_HUD)
      .setOrigin(0, 1)
      .setDepth(103)
      .setVisible(false);

    // MVP3 활성 효과 패널 — 6줄 블록. 현재는 모두 '--' 고정.
    // TODO(mvp3): MVP3 Phase 2 에서 RuntimeState 에 activeEffect/magnet/laser/spinner 필드가 추가되면
    // 여기 defensive read 대신 실제 값을 연결할 것.
    this.mvp3EffectPanelText = scene.add
      .text(8, height - 14, '', TEXT_STYLE_HUD)
      .setOrigin(0, 1)
      .setDepth(103)
      .setVisible(false);
  }

  /**
   * render — 매 프레임 호출. DevContext.isEnabled に応じて描画を切り替える.
   * GC 압박 없이 visible/text/position 갱신만 수행한다.
   */
  render(
    gameplayState: Readonly<GameplayRuntimeState>,
    flowState: Readonly<GameFlowState>,
    devContext: DevContext,
  ): void {
    if (!devContext.isEnabled) {
      this.hide();
      return;
    }

    // 1. 반투명 배경
    this.dimOverlay.setVisible(true);

    // 2. 블록 ID 텍스트 (non-destroyed 블록 위에)
    const activeBlocks = gameplayState.blocks.filter((b) => !b.isDestroyed);
    let poolIndex = 0;
    for (const block of activeBlocks) {
      if (poolIndex >= BLOCK_POOL_SIZE) break;
      const textObj = this.blockIdPool[poolIndex]!;
      textObj
        .setText(block.id)
        .setPosition(block.x, block.y)
        .setVisible(true);
      poolIndex++;
    }
    // 사용하지 않는 풀 슬롯 숨기기
    for (let i = poolIndex; i < BLOCK_POOL_SIZE; i++) {
      this.blockIdPool[i]!.setVisible(false);
    }

    // 3. 공 Trail
    this.trailGraphics.setVisible(true).clear();
    const trailPoints = devContext.ballTrail.getPoints();
    if (trailPoints.length >= 2) {
      for (let i = 1; i < trailPoints.length; i++) {
        const prev = trailPoints[i - 1]!;
        const curr = trailPoints[i]!;
        // 오래된 점(index 0)일수록 alpha 낮음
        const alpha =
          TRAIL_ALPHA_END +
          (TRAIL_ALPHA_START - TRAIL_ALPHA_END) * (i / (trailPoints.length - 1));
        this.trailGraphics.lineStyle(2, TRAIL_COLOR, alpha);
        this.trailGraphics.beginPath();
        this.trailGraphics.moveTo(prev.x, prev.y);
        this.trailGraphics.lineTo(curr.x, curr.y);
        this.trailGraphics.strokePath();
      }
    }

    // 4. 충돌 로그 (우측 상단 최대 5줄)
    const recentCollisions = devContext.collisionLog.getRecent() as readonly CollisionLogEntry[];
    const { width } = this.scene.scale;
    for (let i = 0; i < COLLISION_LOG_LINES; i++) {
      const logText = this.collisionLogTexts[i]!;
      if (i < recentCollisions.length) {
        const entry = recentCollisions[recentCollisions.length - 1 - i]!;
        // target.id があれば表示, なければ kind のみ
        const targetLabel = entry.target.id
          ? `${entry.target.kind}(${entry.target.id})`
          : entry.target.kind;
        logText
          .setText(`[${entry.tick}] ${targetLabel}`)
          .setPosition(width - 8, 8 + i * 16)
          .setVisible(true);
      } else {
        logText.setVisible(false);
      }
    }

    // 5. 공 vx, vy 수치 표시
    const { height } = this.scene.scale;
    const activeBall = gameplayState.balls.find((b) => b.isActive);
    if (activeBall) {
      this.ballVelocityText
        .setText(
          `ball vx=${activeBall.vx.toFixed(1)} vy=${activeBall.vy.toFixed(1)}`,
        )
        .setPosition(8, height - 48)
        .setVisible(true);
    } else {
      this.ballVelocityText.setText('ball: none').setPosition(8, height - 48).setVisible(true);
    }

    // 6. Flow 상태 + session 정보
    const { session } = gameplayState;
    this.flowStateText
      .setText(
        `flow=${flowState.kind} stage=${flowState.currentStageIndex} ` +
          `score=${session.score} lives=${session.lives}`,
      )
      .setPosition(8, height - 30)
      .setVisible(true);

    // 7. MVP3 활성 효과 패널 (좌하단)
    // TODO(mvp3): MVP3 Phase 2 에서 RuntimeState 에 activeEffect/magnet/laser/spinner 필드가 추가되면
    // 여기 defensive read 대신 실제 값을 연결할 것.
    this.mvp3EffectPanelText
      .setText(this.buildMvp3EffectPanel(gameplayState))
      .setPosition(8, height - 14)
      .setVisible(true);
  }

  /**
   * buildMvp3EffectPanel — MVP3 RuntimeState 확장 이전 자리 확보용 패널 텍스트 생성.
   *
   * MVP3 §7-1 에서 예정된 필드:
   *   - bar.activeEffect: 현재 'none' | 'expand' 만 존재 → 그대로 표시
   *   - magnetRemainingTime: 미존재 → '--'
   *   - attachedBallIds: 미존재 → count 0
   *   - laserCooldownRemaining: 미존재 → '--'
   *   - laserShots: 미존재 → 0
   *   - spinnerStates: 미존재 → 0
   *
   * bar.activeEffect 는 현재 타입이 'none' | 'expand' 로 좁혀 있으므로
   * as any 없이 직접 읽는다. MVP3 Phase 2 에서 union이 확장되면 그대로 표시된다.
   */
  private buildMvp3EffectPanel(gameplayState: Readonly<GameplayRuntimeState>): string {
    // bar.activeEffect 는 MVP1 타입에도 존재 — 직접 읽기 안전
    const activeEffect: string = gameplayState.bar.activeEffect;

    // 나머지 필드는 MVP3 Phase 2 이전에는 존재하지 않으므로 defensive read.
    // type assertion 없이 unknown 경유로 안전하게 접근한다.
    const barExtra = gameplayState.bar as Record<string, unknown>;
    const sessionExtra = gameplayState as Record<string, unknown>;

    const magnetMs = typeof barExtra['magnetRemainingTime'] === 'number'
      ? `${(barExtra['magnetRemainingTime'] as number).toFixed(0)}ms`
      : '--';

    const attachedCount =
      Array.isArray(barExtra['attachedBallIds'])
        ? (barExtra['attachedBallIds'] as unknown[]).length
        : 0;

    const laserCd = typeof barExtra['laserCooldownRemaining'] === 'number'
      ? `${(barExtra['laserCooldownRemaining'] as number).toFixed(0)}ms`
      : '--';

    const laserShots = Array.isArray(barExtra['laserShots'])
      ? (barExtra['laserShots'] as unknown[]).length
      : 0;

    const spinnerCount = Array.isArray(sessionExtra['spinnerStates'])
      ? (sessionExtra['spinnerStates'] as unknown[]).length
      : 0;

    return [
      `EFFECT: ${activeEffect}`,
      `MAGNET: ${magnetMs}`,
      `ATTACHED BALLS: ${attachedCount}`,
      `LASER CD: ${laserCd}`,
      `LASER SHOTS: ${laserShots}`,
      `SPINNERS: ${spinnerCount}`,
    ].join('\n');
  }

  /**
   * hide — 모든 오버레이 오브젝트를 숨긴다.
   */
  private hide(): void {
    this.dimOverlay.setVisible(false);
    for (const t of this.blockIdPool) {
      t.setVisible(false);
    }
    this.trailGraphics.setVisible(false).clear();
    for (const t of this.collisionLogTexts) {
      t.setVisible(false);
    }
    this.ballVelocityText.setVisible(false);
    this.flowStateText.setVisible(false);
    this.mvp3EffectPanelText.setVisible(false);
  }
}
