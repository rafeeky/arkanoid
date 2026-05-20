import Phaser from 'phaser';
import { addPressAnimation } from './ButtonPress';

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
  /**
   * onClick 자동 press 애니메이션 토글 (기본 true).
   * 외부에서 별도 GameObject(라벨 등) 까지 묶어 press 시키고 싶으면 false 로 끄고
   * 직접 addPressAnimation(panel, [panel, label, ...]) 호출.
   */
  autoPress?: boolean;
  /**
   * 드롭 섀도우 — 본체 아래 어두운 그림자 layer (reference 픽셀 버튼의 진한 그림자).
   * 기본 true (bevel 켜진 경우만). bevel 없을 땐 무시.
   */
  dropShadow?: boolean;
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
  // 0) drop shadow — 본체 아래 offset 진한 그림자. bevel 사용 시 기본 ON.
  // (reference 픽셀 버튼의 가장 두드러진 특징 — body 아래 진한 그림자가 박스를 "떠 있는" 느낌으로 만듦.)
  const wantShadow = options?.dropShadow ?? options?.bevel ?? false;
  if (wantShadow) {
    const SHADOW_OFFSET = 7;
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(left, top + SHADOW_OFFSET, width, height, cornerRadius);
  }

  // 1) base fill
  g.fillStyle(color, alpha);
  g.fillRoundedRect(left, top, width, height, cornerRadius);

  // 2) bevel — 픽셀아트 게임 UI 버튼 느낌: 위 highlight (튀어나옴) + 아래 shadow + 작은 specular 광점.
  // 레퍼런스 (버튼레퍼런스.png/2/3) 처럼 위쪽 절반 더 강한 밝기, 아래 절반 어두움.
  if (options?.bevel) {
    const halfH = height / 2;
    const inset = 4;
    const innerR = Math.max(2, cornerRadius - 4);
    // top half highlight (강하게)
    g.fillStyle(0xffffff, 0.5);
    g.fillRoundedRect(
      left + inset, top + inset, width - inset * 2, halfH - inset,
      { tl: innerR, tr: innerR, bl: 0, br: 0 },
    );
    // bottom half shadow (강하게)
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(
      left + inset, top + halfH, width - inset * 2, halfH - inset,
      { tl: 0, tr: 0, bl: innerR, br: innerR },
    );
    // 작은 흰 specular 광점 — 위쪽 1/4 가운데 (reference 의 highlight hot spot).
    const specW = width * 0.32;
    const specH = halfH * 0.28;
    const specCx = left + width / 2;
    const specCy = top + halfH * 0.4;
    g.fillStyle(0xffffff, 0.75);
    g.fillEllipse(specCx, specCy, specW, specH);
  }

  // 3) stroke — reference 의 어두운 외곽 띠 (검정 frame) + 안쪽 highlight stroke 두 단.
  if (options?.strokeColor !== undefined) {
    const innerW = options.strokeWidth ?? 3;
    // 외곽 dark frame — reference 의 검정 도트 외곽 두께 (strokeWidth + 3).
    g.lineStyle(innerW + 3, 0x000000, 0.9);
    g.strokeRoundedRect(left, top, width, height, cornerRadius);
    // 내부 highlight stroke (지정된 색).
    g.lineStyle(innerW, options.strokeColor, 1);
    g.strokeRoundedRect(left, top, width, height, cornerRadius);
  }

  g.setScrollFactor(scrollFactor, scrollFactor);
  g.setDepth(depth);
  g.setVisible(false);

  // 4) 외곽 발광 (Phaser 3.60+ WebGL 전용 postFX). Canvas 면 자동 무시.
  if (options?.glowColor !== undefined) {
    g.postFX?.addGlow(options.glowColor, 4, 0, false, 0.1, 16);
  }

  // 5) 클릭 — panel 사각형 영역 setInteractive + (optional) press 애니메이션 (y 2px down).
  if (options?.onClick) {
    g.setInteractive(
      new Phaser.Geom.Rectangle(left, top, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    g.input!.cursor = 'pointer';
    g.on('pointerdown', options.onClick);
    if (options.autoPress !== false) {
      addPressAnimation(g, [g]);
    }
  }

  return g;
}
