import type Phaser from 'phaser';

/**
 * AssetLoader — 개별 PNG 자산 일괄 preload.
 *
 * 모든 자산은 `scripts/process-assets.cjs` 가 원본 시트에서 잘라낸 후
 * (누끼 + 마스코트 trim/center) public/assets/<category>/<name>.png 로 저장.
 *
 * Phaser scene.add.image(x, y, KEY) — KEY 는 아래 ASSET_KEYS 의 값.
 */

const A = '/assets';

/** 자산 키 → 파일 경로. KEY 가 게임 코드에서 참조하는 텍스처 이름. */
const ASSET_FILES: Record<string, string> = {
  // 배경 (1080×1920 리사이즈됨)
  bg_title:      `${A}/backgrounds/bg_title.png`,
  bg_stage_01:   `${A}/backgrounds/bg_stage_01.png`,
  bg_stage_02:   `${A}/backgrounds/bg_stage_02.png`,
  bg_stage_03:   `${A}/backgrounds/bg_stage_03.png`,
  bg_gameover:   `${A}/backgrounds/bg_gameover.png`,
  bg_gameclear:  `${A}/backgrounds/bg_gameclear.png`,

  // 블록 (누끼됨)
  block_basic:       `${A}/blocks/block_basic.png`,
  block_basic_drop:  `${A}/blocks/block_basic_drop.png`,
  block_magnet_drop: `${A}/blocks/block_magnet_drop.png`,
  block_laser_drop:  `${A}/blocks/block_laser_drop.png`,
  block_tough:       `${A}/blocks/block_tough.png`,

  // (slider / spinner 스프라이트는 의도적으로 빠짐 — Rectangle/Arc / 3D Graphics 로 직접 그림)

  // Ball / Item 스프라이트 (alpha 누끼됨).
  ball:        `${A}/gameplay/ball.png`,
  item_expand: `${A}/gameplay/item_expand.png`,
  item_magnet: `${A}/gameplay/item_magnet.png`,
  item_laser:  `${A}/gameplay/item_laser.png`,

  // 바 스프라이트 (120×16, alpha 누끼됨). activeEffect 별 4종.
  bar_normal:        `${A}/bars/bar_normal.png`,
  bar_expand_tint:   `${A}/bars/bar_expand_tint.png`,
  bar_magnet_tint:   `${A}/bars/bar_magnet_tint.png`,
  bar_laser_tint:    `${A}/bars/bar_laser_tint.png`,

  // 테두리 / 문 스프라이트 (이미 alpha 누끼됨)
  border_horizontal: `${A}/borders/border_horizontal.png`,
  border_vertical:   `${A}/borders/border_vertical.png`,
  door_closed:       `${A}/borders/door_closed.png`,
  door_opening_0:    `${A}/borders/door_opening_frame0.png`,
  door_opening_1:    `${A}/borders/door_opening_frame1.png`,
  door_opening_2:    `${A}/borders/door_opening_frame2.png`,
  door_opening_3:    `${A}/borders/door_opening_frame3.png`,
  door_opening_4:    `${A}/borders/door_opening_frame4.png`,
};

// 마스코트 프레임 (5종 × 4프레임 = 20장)
const MASCOT_IDS = ['albatross', 'kongming', 'snowrabbit', 'reaper', 'seraphin'] as const;
for (const id of MASCOT_IDS) {
  for (let i = 0; i < 4; i++) {
    ASSET_FILES[`mascot.${id}.frame${i}`] = `${A}/mascots/${id}/frame${i}.png`;
  }
  // Title 카루셀용 portrait (character.png 에서 추출)
  ASSET_FILES[`portrait.${id}`] = `${A}/portraits/${id}.png`;
  // V2 portrait — 가로세로 동일 정사각형 (테두리 박스 안 표시용).
  ASSET_FILES[`portrait2.${id}`] = `${A}/portraits2/${id}.png`;
}

// IntroStory 일러스트
for (let i = 1; i <= 4; i++) {
  const num = String(i).padStart(2, '0');
  ASSET_FILES[`intro_story_${num}`] = `${A}/intro/intro_story_${num}.png`;
}

// 게임 오버 화면 마스코트 — 개별 4프레임 PNG (RGBA, 누끼 처리됨).
for (let i = 1; i <= 4; i++) {
  ASSET_FILES[`gameover_frame_${i}`] = `${A}/mascots/gameover_frame_${i}.png`;
}

/** Spritesheet 자산 — 한 PNG 안에 여러 frame. */
const SPRITESHEET_FILES: Record<string, { path: string; frameWidth: number; frameHeight: number }> = {
  // 게임 클리어 마스코트 dance (2009×591, 4 frame 가로, frame 502×591. 마지막 1픽셀은 무시됨).
  dance_sheet: { path: `${A}/mascots/dance_sheet.png`, frameWidth: 502, frameHeight: 591 },
};

/** Phaser scene.preload() 에서 호출. 모든 자산 등록. */
export function preloadAssets(scene: Phaser.Scene): void {
  for (const [key, path] of Object.entries(ASSET_FILES)) {
    scene.load.image(key, path);
  }
  for (const [key, info] of Object.entries(SPRITESHEET_FILES)) {
    scene.load.spritesheet(key, info.path, { frameWidth: info.frameWidth, frameHeight: info.frameHeight });
  }
}
