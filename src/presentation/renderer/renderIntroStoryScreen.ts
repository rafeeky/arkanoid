import type Phaser from 'phaser';
import type { IntroScreenViewModel } from '../view-models/IntroScreenViewModel';
import { createTextPanel } from './components/TextPanel';

/**
 * IntroStoryScreen — 스토리 화면 (게임 시작 전 4페이지 narrative).
 *
 * 정석 (learning_principles_albatross §4): 게임 월드 미노출 → **전부 UI 카메라** (canvas 좌표계).
 * 이번 작업으로 정석 통일 (옛 코드는 main 카메라 잔재).
 *
 * 레이아웃:
 *   - 풀스크린 배경 이미지 (intro_story_01..04) — 페이지별 한 장만 visible
 *   - 텍스트박스 — 이미지 위 상단에 떠 있음. 옛 시각 위치 그대로 (좌표만 canvas 로 1.5×).
 */
export type IntroStoryScreenObjects = {
  /** 스토리 텍스트 뒤 반투명 패널. */
  storyPanel: Phaser.GameObjects.Graphics;
  storyText: Phaser.GameObjects.Text;
  /** 풀스크린 배경 4장. pageIndex 에 맞춰 한 장만 visible. */
  storyImages: Phaser.GameObjects.Image[];
};

// 풀스크린 배경 (canvas 좌표계).
const FULLSCREEN_CX = 540;
const FULLSCREEN_CY = 960;
const FULLSCREEN_W = 1080;
const FULLSCREEN_H = 1920;
const BG_DEPTH = -10;

// 텍스트박스 — 풀스크린 배경 위에서 하단에 위치. 새/하늘 일러스트 가리지 않게.
// canvas 1920 의 ~78% (cy=1500), panel bottom edge 1635 → 화면 아래에서 285px.
const PANEL_CX = 540;
const PANEL_CY = 1500;
const PANEL_W = 1050;
const PANEL_H = 270;
const TEXT_FONT = '42px';
const TEXT_WRAP_W = 960;

const IMG_KEYS = [
  'intro_story_01',
  'intro_story_02',
  'intro_story_03',
  'intro_story_04',
] as const;

export function createIntroStoryScreenObjects(
  scene: Phaser.Scene,
): IntroStoryScreenObjects {
  // 1) 풀스크린 배경 4장. UI 카메라 (scrollFactor 0). depth -10 — 텍스트박스보다 뒤.
  const storyImages: Phaser.GameObjects.Image[] = IMG_KEYS.map((key) => {
    const img = scene.add
      .image(FULLSCREEN_CX, FULLSCREEN_CY, key)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(FULLSCREEN_W, FULLSCREEN_H)
      .setScrollFactor(0)
      .setDepth(BG_DEPTH)
      .setVisible(false);
    return img;
  });

  // 2) 텍스트박스 — UI 카메라 + 이미지 위. alpha 0.6 (옛 0.45) 로 가독성 강화.
  const storyPanel = createTextPanel(scene, PANEL_CX, PANEL_CY, PANEL_W, PANEL_H, {
    scrollFactor: 0,
    alpha: 0.6,
  });

  const storyText = scene.add
    .text(PANEL_CX, PANEL_CY, '', {
      fontSize: TEXT_FONT,
      color: '#e0e0e0',
      fontFamily: 'DNFBitBitv2, monospace',
      align: 'center',
      wordWrap: { width: TEXT_WRAP_W },
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setVisible(false);

  return { storyPanel, storyText, storyImages };
}

export function renderIntroStoryScreen(
  objects: IntroStoryScreenObjects,
  viewModel: IntroScreenViewModel,
): void {
  if (!viewModel.isVisible) {
    hideIntroStoryScreen(objects);
    return;
  }
  objects.storyPanel.setVisible(true);
  objects.storyText.setText(viewModel.visibleText).setVisible(true);
  for (let i = 0; i < objects.storyImages.length; i++) {
    const img = objects.storyImages[i];
    if (img) img.setVisible(i === viewModel.pageIndex);
  }
}

export function hideIntroStoryScreen(objects: IntroStoryScreenObjects): void {
  objects.storyPanel.setVisible(false);
  objects.storyText.setVisible(false);
  for (const img of objects.storyImages) img.setVisible(false);
}
