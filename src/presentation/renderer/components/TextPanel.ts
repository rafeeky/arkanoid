import Phaser from 'phaser';

/**
 * TextPanel — 텍스트 그룹 뒤에 깔리는 반투명 어두운 둥근 패널.
 *
 * 사용처:
 * - 타이틀 화면 정보 그룹 (캐릭터/파워업/점수/난이도)
 * - 스토리/안내 텍스트 배경
 * - 향후 추가될 내러티브 텍스트
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
  /** 카메라 스크롤 영향 (0=UI 카메라 고정). 기본 0. */
  scrollFactor?: number;
  /** depth 값. 기본 -10 (텍스트 뒤). */
  depth?: number;
  /** stroke 색 (16진수). 미지정 시 stroke 없음 (단순 패널). */
  strokeColor?: number;
  /** stroke 두께. 기본 3. */
  strokeWidth?: number;
  /**
   * 버튼 입체감 — true 면 위쪽 절반에 white highlight overlay + 아래쪽 절반 dark shadow.
   * 평평한 panel 보다 둥글게 튀어나온 느낌. 기본 false.
   */
  bevel?: boolean;
  /**
   * 외곽 발광 효과 색 (WebGL 전용 postFX.addGlow). 미지정 시 발광 없음.
   * Canvas 렌더러에서는 자동 무시.
   */
  glowColor?: number;
  /**
   * 클릭 핸들러. 지정 시 panel 사각형 영역이 interactive 가 됨.
   */
  onClick?: () => void;
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
  // 1) base fill
  g.fillStyle(color, alpha);
  g.fillRoundedRect(left, top, width, height, cornerRadius);

  // 2) bevel — 아케이드 버튼 캡 느낌: 위 highlight (튀어나옴) + 아래 shadow + 작은 specular 광점.
  if (options?.bevel) {
    const halfH = height / 2;
    const inset = 4;
    const innerR = Math.max(2, cornerRadius - 4);
    // top half highlight — 둥근 모서리(위쪽 코너만) 으로 자연스럽게.
    g.fillStyle(0xffffff, 0.32);
    g.fillRoundedRect(
      left + inset, top + inset, width - inset * 2, halfH - inset,
      { tl: innerR, tr: innerR, bl: 0, br: 0 },
    );
    // bottom half shadow — 둥근 모서리(아래쪽 코너만).
    g.fillStyle(0x000000, 0.32);
    g.fillRoundedRect(
      left + inset, top + halfH, width - inset * 2, halfH - inset,
      { tl: 0, tr: 0, bl: innerR, br: innerR },
    );
    // 작은 흰 specular 광점 — 위쪽 1/4 가운데에 가로로 길쭉한 타원. 아케이드 캡 광택.
    const specW = width * 0.45;
    const specH = halfH * 0.35;
    const specCx = left + width / 2;
    const specCy = top + halfH * 0.45;
    g.fillStyle(0xffffff, 0.55);
    g.fillEllipse(specCx, specCy, specW, specH);
  }

  // 3) stroke (위 effect 들 덮어 가장 위에 그림)
  if (options?.strokeColor !== undefined) {
    g.lineStyle(options.strokeWidth ?? 3, options.strokeColor, 1);
    g.strokeRoundedRect(left, top, width, height, cornerRadius);
  }

  g.setScrollFactor(scrollFactor, scrollFactor);
  g.setDepth(depth);
  g.setVisible(false);

  // 4) 외곽 발광 (Phaser 3.60+ WebGL 전용 postFX). Canvas 면 자동 무시.
  if (options?.glowColor !== undefined) {
    g.postFX?.addGlow(options.glowColor, 4, 0, false, 0.1, 16);
  }

  // 5) 클릭 — panel 사각형 영역 setInteractive.
  if (options?.onClick) {
    g.setInteractive(
      new Phaser.Geom.Rectangle(left, top, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    g.input!.cursor = 'pointer';
    g.on('pointerdown', options.onClick);
  }

  return g;
}
