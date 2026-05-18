import type Phaser from 'phaser';
import type { IntroScreenViewModel } from '../view-models/IntroScreenViewModel';
import { createTextPanel } from './components/TextPanel';

export type IntroStoryScreenObjects = {
  /** 스토리 텍스트 뒤 반투명 패널 (가독성 + 향후 내러티브 텍스트도 동일 스타일 재사용). */
  storyPanel: Phaser.GameObjects.Graphics;
  storyText: Phaser.GameObjects.Text;
  /** 페이지별 일러스트 4장 (intro_story_01..04). pageIndex 에 맞춰 한 장만 visible. */
  storyImages: Phaser.GameObjects.Image[];
};

/** 일러스트 영역 (플레이필드 로컬 좌표). 원본 1852×849 비율 ≈ 2.18:1. */
const IMG_CENTER_X = 360;
const IMG_CENTER_Y = 560;
const IMG_WIDTH = 700;
const IMG_HEIGHT = 320;

const IMG_KEYS = [
  'intro_story_01',
  'intro_story_02',
  'intro_story_03',
  'intro_story_04',
] as const;

export function createIntroStoryScreenObjects(
  scene: Phaser.Scene,
): IntroStoryScreenObjects {
  // 스토리 텍스트 뒤 반투명 패널 (main 카메라, playfield-local 좌표, scrollFactor=1 default).
  // 텍스트 영역 (360, 200) 중심, 가로 ~700, 세로 ~180 (4줄 정도 텍스트 + padding).
  const storyPanel = createTextPanel(scene, 360, 200, 700, 180, { scrollFactor: 1 });

  const storyText = scene.add
    .text(360, 200, '', {
      fontSize: '28px',
      color: '#e0e0e0',
      fontFamily: 'DNFBitBitv2, monospace',
      align: 'center',
      wordWrap: { width: 640 },
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  // 4장의 일러스트를 모두 미리 생성하고 페이지에 맞는 한 장만 visible.
  const storyImages: Phaser.GameObjects.Image[] = IMG_KEYS.map((key) => {
    const img = scene.add.image(IMG_CENTER_X, IMG_CENTER_Y, key).setOrigin(0.5, 0.5);
    // 원본 1852×849 → 480×220 다운스케일. setDisplaySize 가 비율 무시하지만 원본이 이미 동일 비율이라 OK.
    img.setDisplaySize(IMG_WIDTH, IMG_HEIGHT);
    img.setVisible(false);
    return img;
  });

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
  // pageIndex 에 맞는 한 장만 visible, 나머지는 hide.
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
