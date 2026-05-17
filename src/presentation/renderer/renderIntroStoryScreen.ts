import type Phaser from 'phaser';
import type { IntroScreenViewModel } from '../view-models/IntroScreenViewModel';

export type IntroStoryScreenObjects = {
  storyText: Phaser.GameObjects.Text;
  /** 페이지별 일러스트 4장 (intro_story_01..04). pageIndex 에 맞춰 한 장만 visible. */
  storyImages: Phaser.GameObjects.Image[];
};

/** 일러스트가 차지하는 영역 (플레이필드 로컬 좌표). asset-spec.md §1-9b 와 동일. */
const IMG_CENTER_X = 360;
const IMG_CENTER_Y = 530;
const IMG_WIDTH = 480;
const IMG_HEIGHT = 220;

const IMG_KEYS = [
  'intro_story_01',
  'intro_story_02',
  'intro_story_03',
  'intro_story_04',
] as const;

export function createIntroStoryScreenObjects(
  scene: Phaser.Scene,
): IntroStoryScreenObjects {
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

  return { storyText, storyImages };
}

export function renderIntroStoryScreen(
  objects: IntroStoryScreenObjects,
  viewModel: IntroScreenViewModel,
): void {
  if (!viewModel.isVisible) {
    hideIntroStoryScreen(objects);
    return;
  }
  objects.storyText.setText(viewModel.visibleText).setVisible(true);
  // pageIndex 에 맞는 한 장만 visible, 나머지는 hide.
  for (let i = 0; i < objects.storyImages.length; i++) {
    const img = objects.storyImages[i];
    if (img) img.setVisible(i === viewModel.pageIndex);
  }
}

export function hideIntroStoryScreen(objects: IntroStoryScreenObjects): void {
  objects.storyText.setVisible(false);
  for (const img of objects.storyImages) img.setVisible(false);
}
