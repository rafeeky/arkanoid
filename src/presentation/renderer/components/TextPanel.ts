import type Phaser from 'phaser';

/**
 * TextPanel — 텍스트 그룹 뒤에 깔리는 반투명 어두운 둥근 패널.
 *
 * **버튼 아님** — 단순 정보 카드/배경 용도. 버튼이 필요하면 `ui/Button.ts` 의 `createButton`.
 *
 * 사용처:
 * - 타이틀의 mascot 정보 카드 / POWERUPS 카드 (depth -10)
 * - 스토리/안내 텍스트 배경
 *
 * Unity 매핑: rounded background Image with semi-transparent fill.
 */
export type TextPanelOptions = {
  /** 반투명도 (0=완전 투명, 1=불투명). 기본 0.45. */
  alpha?: number;
  /** 모서리 반지름 (px). 기본 16. */
  cornerRadius?: number;
  /** 채움 색 (16진수). 기본 검정. */
  color?: number;
  /**
   * 카메라 선택. 기본 0 = UI 카메라 (canvas 좌표계).
   * main 카메라용 화면 (예: IntroStoryScreen) 에선 `1` 명시.
   * 자세한 룰: [[learning_principles_albatross]] §4 카메라 컨벤션.
   */
  scrollFactor?: number;
  /** depth 값. 기본 -10 (텍스트 뒤). */
  depth?: number;
};

/**
 * createTextPanel — 중심 좌표 + 사이즈로 둥근 반투명 패널 1개 생성.
 *
 * 반환: Graphics 객체. setVisible(true/false) 로 표시 토글.
 * 초기 상태: hidden (renderer 가 명시적으로 visible 처리해야 함).
 */
export function createTextPanel(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  width: number,
  height: number,
  options?: TextPanelOptions,
): Phaser.GameObjects.Graphics {
  const alpha = options?.alpha ?? 0.45;
  const cornerRadius = options?.cornerRadius ?? 16;
  const color = options?.color ?? 0x000000;
  const scrollFactor = options?.scrollFactor ?? 0;
  const depth = options?.depth ?? -10;

  const left = cx - width / 2;
  const top = cy - height / 2;

  const g = scene.add.graphics();
  g.fillStyle(color, alpha);
  g.fillRoundedRect(left, top, width, height, cornerRadius);
  g.setScrollFactor(scrollFactor, scrollFactor);
  g.setDepth(depth);
  g.setVisible(false);

  return g;
}
