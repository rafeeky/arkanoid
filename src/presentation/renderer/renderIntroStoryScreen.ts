import type Phaser from 'phaser';
import type { IntroScreenViewModel } from '../view-models/IntroScreenViewModel';

export type IntroStoryScreenObjects = {
  storyText: Phaser.GameObjects.Text;
};

/**
 * createIntroStoryScreenObjects — IntroStory 화면에 필요한 Phaser 오브젝트를 1회 생성한다.
 *
 * Unity 매핑: IntroStoryView MonoBehaviour.
 */
export function createIntroStoryScreenObjects(
  scene: Phaser.Scene,
): IntroStoryScreenObjects {
  const storyText = scene.add
    .text(360, 300, '', {
      fontSize: '28px',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      align: 'center',
      wordWrap: { width: 640 },
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  return { storyText };
}

/**
 * renderIntroStoryScreen — IntroStory 화면 오브젝트를 ViewModel에 맞게 갱신한다.
 *
 * isVisible=false 이면 hide 처리한다.
 *
 * Unity 매핑: IntroStoryView MonoBehaviour.SetText() / SetVisible().
 */
export function renderIntroStoryScreen(
  objects: IntroStoryScreenObjects,
  viewModel: IntroScreenViewModel,
): void {
  if (!viewModel.isVisible) {
    hideIntroStoryScreen(objects);
    return;
  }
  objects.storyText.setText(viewModel.visibleText).setVisible(true);
}

/**
 * hideIntroStoryScreen — IntroStory 화면 오브젝트를 전부 숨긴다.
 */
export function hideIntroStoryScreen(objects: IntroStoryScreenObjects): void {
  objects.storyText.setVisible(false);
}
