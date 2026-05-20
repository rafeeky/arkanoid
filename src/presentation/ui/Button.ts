import Phaser from 'phaser';

/**
 * Button — 알바트로스 (Arkanoid TS+Phaser) 공용 버튼 컴포넌트.
 *
 * 5곳에 흩어져 있던 버튼 그리기 코드 (TextPanel, PauseOverlay createButton, Title UNLOCK 인라인,
 * HUD 일시정지 인라인, GameOver/GameClear 인라인) 를 한 곳으로 통합.
 *
 * 디자인 패턴 (reference 픽셀 버튼 사진 기반):
 *   1) drop shadow — body 아래 7px offset 진한 그림자
 *   2) body fill — variant 색 (또는 오버라이드)
 *   3) outer dark frame — 두꺼운 검정 stroke (reference 의 도트 외곽)
 *   4) inner highlight stroke — variant 색 (외곽보다 안쪽)
 *   5) top half highlight + bottom half shadow — 입체감 bevel
 *   6) specular hot spot — 위쪽 가운데 작은 타원 광점
 *   7) label — 흰 굵은 텍스트 (toggle 모드는 \nON/\nOFF 자동)
 *   8) press anim — Container.y += 2 (모든 자식 자동 따라감)
 *
 * 컨테이너 기반 — 자식의 transform 이 한 곳 (container.y) 에 SSOT 로 모임.
 * "숨겨진 결합" 을 코드 구조로 드러내는 방식 ([[learning_principles_albatross]]).
 */
export type ButtonVariant = 'primary' | 'danger' | 'neutral';

export type ButtonOptions = {
  /**
   * **버튼 "중심" 기준 좌표** (origin 0.5, 0.5).
   *
   * **좌표계는 `scrollFactor` 가 결정**:
   * - `scrollFactor: 1` (default) — *main 카메라 = playfield 좌표계 (720×720)*. 게임 화면 (GameOver/Clear/Title/RoundIntro 등) 의 텍스트들이 쓰는 좌표계. 예: 화면 가운데 = cx=360.
   * - `scrollFactor: 0` — *UI 카메라 = canvas 좌표계 직접 (1080×1920)*. HUD/PauseOverlay 처럼 *canvas 절대 좌표* 가 필요한 곳용. 예: 우상단 일시정지 버튼 cx=1020.
   *
   * 같은 화면 안 다른 객체들과 *같은 카메라* 를 써야 위치가 맞음 — 안 그러면 zoom/scroll 차이로 어긋남.
   */
  cx: number;
  cy: number;
  /** 사이즈 (px). */
  w: number;
  h: number;
  /** 라벨 텍스트. toggle 모드면 "배경음" 같은 base 만 — \nON/\nOFF 는 자동 부착. */
  label: string;
  /** 색 톤. default 'neutral'. */
  variant?: ButtonVariant;
  /** 폰트 사이즈 (px 단위 문자열). default '24px'. */
  fontSize?: string;
  /** 폰트 색. default '#ffffff'. */
  fontColor?: string;
  /** 모서리 radius. default 14. */
  cornerRadius?: number;
  /**
   * 외곽 발광 (WebGL postFX). default false.
   *
   * **glow 룰** (learning_principles_albatross.md):
   * - **어두운 backdrop 위 액션 버튼** 에만 glow on. 예: PauseOverlay (검정 backdrop) 의 QUIT/RESUME.
   * - **밝은 배경** 의 버튼은 glow off. 예: Title (밝은 배경) 의 NORMAL/HARD, UNLOCK.
   * - 토글/아이콘 버튼은 일반적으로 off (시각 무게 작아야).
   */
  glow?: boolean;
  /** 클릭 콜백 (선택). */
  onClick?: () => void;
  /** toggle 모드 — ON/OFF 상태. label 끝에 \nON / \nOFF 자동. */
  toggle?: boolean;
  /** toggle 초기 상태. default true. */
  toggleInitiallyOn?: boolean;
  /** 색 오버라이드 (variant 무시). UNLOCK 의 주황색 같은 특수 케이스용. */
  fillColor?: number;
  strokeColor?: number;
  glowColor?: number;
  /** depth (scene 내 z-order). 기본 미설정 (Phaser 기본 = 0). PauseOverlay 같은 곳에선 501 등 명시. */
  depth?: number;
  /**
   * **카메라 선택** (좌표계 결정). default `1` = main 카메라 (playfield 좌표계).
   * HUD / PauseOverlay 같은 *canvas 절대 좌표* 화면은 `0` 명시.
   */
  scrollFactor?: number;
};

export type Button = {
  /** Phaser Container — 외부에서 추가 자식 (예: HUD 일시정지 아이콘 바) 을 add 가능. */
  container: Phaser.GameObjects.Container;
  /** body Rectangle — hit area + interactive 타겟. 외부에서 pointerdown 추가 등록 가능. */
  body: Phaser.GameObjects.Rectangle;
  /** label Text — toggle 모드 외 직접 갱신 가능 (예: BUY 가격 변동). */
  label: Phaser.GameObjects.Text;
  /** 라벨 텍스트 갱신. toggle 모드면 ON/OFF 자동 부착. */
  setLabel(text: string): void;
  /** visible 토글 — container 단위. */
  setVisible(v: boolean): void;
  /** toggle 모드 ON/OFF 설정. 라벨 + 색 자동 갱신. toggle 아니면 무시. */
  setOn(on: boolean): void;
  /** 현재 ON/OFF 상태. toggle 아니면 항상 true. */
  getOn(): boolean;
  /**
   * disabled 상태 설정 — 색 자체가 dark 로 변경 + glow off + label 회색.
   * (alpha 만 낮추는 방식 대신 *명확한 시각 차이* — gold 부족 같은 상황 인지용.)
   * 클릭 자체는 막지 않음 (호출자가 핸들러에서 afford 체크).
   */
  setDisabled(disabled: boolean): void;
};

const VARIANT_COLORS: Record<ButtonVariant, { fill: number; stroke: number; glow: number }> = {
  primary: { fill: 0x44aa44, stroke: 0x88dd88, glow: 0x44cc66 },
  danger:  { fill: 0xcc4444, stroke: 0xff8888, glow: 0xff5050 },
  neutral: { fill: 0x1a2a3a, stroke: 0x4488cc, glow: 0x4488cc },
};

const DROP_SHADOW_OFFSET = 7;
const DARK_FRAME_WIDTH_EXTRA = 3;  // inner stroke width + 3
const INNER_STROKE_WIDTH = 3;
const BEVEL_INSET = 4;
const PRESS_OFFSET = 2;
const LABEL_OFF_COLOR = '#666666';
const LABEL_DISABLED_COLOR = '#888888';

/**
 * createButton — 한 줄 호출로 완성 버튼 1개 생성.
 *
 * 반환된 Button.container 를 외부에서 추가 자식 (아이콘 등) 추가 가능.
 * 초기 visible=false — 호출자가 명시적으로 setVisible(true) 해야 보임.
 */
export function createButton(scene: Phaser.Scene, opt: ButtonOptions): Button {
  const variant = opt.variant ?? 'neutral';
  const base = VARIANT_COLORS[variant];
  const fill = opt.fillColor ?? base.fill;
  const stroke = opt.strokeColor ?? base.stroke;
  const glowColor = opt.glowColor ?? base.glow;
  const cornerR = opt.cornerRadius ?? 14;
  const fontSize = opt.fontSize ?? '24px';
  const fontColor = opt.fontColor ?? '#ffffff';
  // default scrollFactor=1 — main 카메라(playfield 좌표계). 옛 화면들의 컨벤션과 일치.
  // HUD/PauseOverlay 처럼 canvas 절대 좌표 쓰는 화면은 호출 시 scrollFactor:0 명시.
  const scrollFactor = opt.scrollFactor ?? 1;

  const halfW = opt.w / 2;
  const halfH = opt.h / 2;
  const innerR = Math.max(2, cornerR - 4);

  // 컨테이너 — 모든 자식의 local 좌표 원점이 button center (0, 0).
  // container.y 를 움직이면 자식 (shadow/body/overlay/label/외부 추가물) 이 다 같이 이동.
  const container = scene.add.container(opt.cx, opt.cy);
  container.setScrollFactor(scrollFactor);
  container.setVisible(false);
  if (opt.depth !== undefined) container.setDepth(opt.depth);

  // *** scrollFactor 룰 ***
  // GameScene.classifyCameras 가 자식의 scrollFactor 를 *개별로* 검사해서 카메라 분류함.
  // container 의 scrollFactor 가 0 이어도 자식이 default(1) 면 자식만 main 카메라(zoom 1.5)로 가
  // 위치/사이즈가 어긋남. → 자식 전부에 setScrollFactor(scrollFactor) 명시.
  const sf = scrollFactor;

  // 1) drop shadow — body 아래 7px.
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.55);
  shadow.fillRoundedRect(-halfW, -halfH + DROP_SHADOW_OFFSET, opt.w, opt.h, cornerR);
  shadow.setScrollFactor(sf, sf);
  container.add(shadow);

  // 2) body — hit area 전용 (fillAlpha=0, 투명). 실제 fill 색은 overlay 가 *둥글게* 그림.
  //
  // *** 왜 body 자체에 fill 안 그리는가 ***
  //   Phaser Rectangle 은 *완전한 직사각형* (둥근 모서리 옵션 없음). body 에 fill 을 주면
  //   둥근 overlay stroke 바깥, 직사각형 모서리 안 영역에 fill 이 *삼각형* 처럼 삐져나옴.
  //   → body 는 interactive hit area 로만 쓰고, 시각 fill 은 overlay 에 둥글게 그린다.
  //   fillAlpha=0 이어도 setInteractive 는 정상 동작 (Phaser 의 input 은 visual 과 독립).
  const body = scene.add.rectangle(0, 0, opt.w, opt.h, 0x000000, 0).setOrigin(0.5, 0.5);
  body.setScrollFactor(sf, sf);
  body.setInteractive({ useHandCursor: true });
  container.add(body);

  // 3) overlay — fill (둥근) + frame (외곽 dark + 내부 highlight) + bevel 한 Graphics 에 묶음.
  // (setDisabled 호출 시 색을 dark 로 재그리기 위해 helper 로 추출.)
  const overlay = scene.add.graphics();
  const drawOverlay = (fillC: number, strokeC: number, bevelAlpha: number): void => {
    overlay.clear();
    // 3-a) fill — 둥근 모서리. (body 의 직사각형 fill 대체.)
    overlay.fillStyle(fillC, 1);
    overlay.fillRoundedRect(-halfW, -halfH, opt.w, opt.h, cornerR);
    // 3-b) outer dark frame.
    overlay.lineStyle(INNER_STROKE_WIDTH + DARK_FRAME_WIDTH_EXTRA, 0x000000, 0.9);
    overlay.strokeRoundedRect(-halfW, -halfH, opt.w, opt.h, cornerR);
    // 3-c) inner highlight stroke — variant 색 (또는 disabled dark).
    overlay.lineStyle(INNER_STROKE_WIDTH, strokeC, 1);
    overlay.strokeRoundedRect(-halfW, -halfH, opt.w, opt.h, cornerR);
    // 3-d) bevel — 위 절반 흰 highlight + 아래 절반 검정 shadow.
    overlay.fillStyle(0xffffff, bevelAlpha);
    overlay.fillRoundedRect(
      -halfW + BEVEL_INSET, -halfH + BEVEL_INSET,
      opt.w - BEVEL_INSET * 2, halfH - BEVEL_INSET,
      { tl: innerR, tr: innerR, bl: 0, br: 0 },
    );
    overlay.fillStyle(0x000000, bevelAlpha);
    overlay.fillRoundedRect(
      -halfW + BEVEL_INSET, 0,
      opt.w - BEVEL_INSET * 2, halfH - BEVEL_INSET,
      { tl: 0, tr: 0, bl: innerR, br: innerR },
    );
  };
  drawOverlay(fill, stroke, 0.5);
  overlay.setScrollFactor(sf, sf);
  container.add(overlay);

  // 4) glow (WebGL 전용 postFX). overlay 에 적용 — 둥근 fill 외곽이 발광.
  // (body 가 invisible 이라 body 에 적용하면 효과 안 보임. overlay 가 visual SSOT.)
  // glowFx reference 보관 — setDisabled 시 active 토글.
  let glowFx: Phaser.FX.Glow | undefined;
  if (opt.glow) {
    glowFx = overlay.postFX?.addGlow(glowColor, 5, 0, false, 0.1, 14) as Phaser.FX.Glow | undefined;
  }

  // 5) label.
  let onState = opt.toggle ? (opt.toggleInitiallyOn ?? true) : true;
  const labelText = scene.add
    .text(0, 0, formatLabel(opt.label, opt.toggle, onState), {
      fontSize, color: fontColor, fontFamily: 'DNFBitBitv2, monospace', fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5, 0.5);
  if (opt.toggle) labelText.setLineSpacing(4);
  if (opt.toggle && !onState) labelText.setColor(LABEL_OFF_COLOR);
  labelText.setScrollFactor(sf, sf);
  container.add(labelText);

  // 6) press 애니 — Container.y 만 토글. 모든 자식 자동 동기화.
  let pressed = false;
  let baselineY = opt.cy;
  const press = (): void => {
    if (pressed) return;
    pressed = true;
    baselineY = container.y;
    container.y = baselineY + PRESS_OFFSET;
  };
  const release = (): void => {
    if (!pressed) return;
    pressed = false;
    container.y = baselineY;
  };
  body.on('pointerdown', press);
  body.on('pointerup', release);
  body.on('pointerout', release);
  body.on('pointerupoutside', release);

  // 7) onClick — 별도 핸들러 등록. press 와 독립.
  if (opt.onClick) {
    body.on('pointerdown', opt.onClick);
  }

  return {
    container,
    body,
    label: labelText,
    setLabel(text: string) {
      labelText.setText(formatLabel(text, opt.toggle, onState));
    },
    setVisible(v: boolean) {
      container.setVisible(v);
    },
    setOn(on: boolean) {
      if (!opt.toggle) return;
      onState = on;
      labelText.setText(formatLabel(opt.label, true, on));
      labelText.setColor(on ? fontColor : LABEL_OFF_COLOR);
    },
    getOn() {
      return onState;
    },
    setDisabled(disabled: boolean) {
      if (disabled) {
        // dark 색 + bevel 약화 + glow off + label 회색.
        drawOverlay(0x333333, 0x555555, 0.25);
        labelText.setColor(LABEL_DISABLED_COLOR);
        if (glowFx) glowFx.active = false;
      } else {
        // 원래 색 복원.
        drawOverlay(fill, stroke, 0.5);
        labelText.setColor(fontColor);
        if (glowFx) glowFx.active = true;
      }
    },
  };
}

function formatLabel(label: string, toggle: boolean | undefined, on: boolean): string {
  if (!toggle) return label;
  return `${label}\n${on ? 'ON' : 'OFF'}`;
}
