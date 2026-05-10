import type Phaser from 'phaser';
import type { IntroScreenViewModel } from '../view-models/IntroScreenViewModel';

export type IntroStoryScreenObjects = {
  storyText: Phaser.GameObjects.Text;
  /** Phase 8: 페이지별 이미지 placeholder. Unity 포팅 시 실제 스토리 일러스트로 교체. */
  imagePlaceholder: Phaser.GameObjects.Rectangle;
  imagePlaceholderLabel: Phaser.GameObjects.Text;
};

/**
 * createIntroStoryScreenObjects — IntroStory 화면에 필요한 Phaser 오브젝트를 1회 생성한다.
 *
 * 레이아웃 (플레이필드 0..720 로컬 좌표):
 * - storyText: y=200 (위쪽), 워드랩 640px
 * - imagePlaceholder: y=420..640 (아래쪽), 480×220 흰 사각형 (placeholder)
 *
 * Unity 매핑: IntroStoryView MonoBehaviour. imagePlaceholder → Image 컴포넌트로 교체.
 */
export function createIntroStoryScreenObjects(
  scene: Phaser.Scene,
): IntroStoryScreenObjects {
  const storyText = scene.add
    .text(360, 200, '', {
      fontSize: '28px',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      align: 'center',
      wordWrap: { width: 640 },
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  // Phase 8: 이미지 placeholder. Unity 에서 페이지별 일러스트로 교체.
  const imagePlaceholder = scene.add
    .rectangle(360, 530, 480, 220, 0xffffff)
    .setOrigin(0.5, 0.5)
    .setStrokeStyle(2, 0x888888)
    .setVisible(false);

  const imagePlaceholderLabel = scene.add
    .text(360, 530, 'STORY IMAGE', {
      fontSize: '20px',
      color: '#888888',
      fontFamily: 'monospace',
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false);

  return { storyText, imagePlaceholder, imagePlaceholderLabel };
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
  objects.imagePlaceholder.setVisible(true);
  objects.imagePlaceholderLabel.setVisible(true);
}

/**
 * hideIntroStoryScreen — IntroStory 화면 오브젝트를 전부 숨긴다.
 */
export function hideIntroStoryScreen(objects: IntroStoryScreenObjects): void {
  objects.storyText.setVisible(false);
  objects.imagePlaceholder.setVisible(false);
  objects.imagePlaceholderLabel.setVisible(false);
}
