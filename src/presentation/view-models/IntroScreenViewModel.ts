/**
 * IntroScreenViewModel — IntroStory 화면 표시용 ViewModel.
 *
 * ScreenPresenter.buildIntroScreenViewModel() 이 생성한다.
 * visibleText는 introTypingProgress에 따라 잘린 텍스트다.
 *
 * Unity 매핑: IntroStoryView MonoBehaviour의 입력 데이터.
 */
export type IntroScreenViewModel = {
  /** 현재 보여질 텍스트 (progress에 따라 slice된 값) */
  visibleText: string;
  /** done phase면 false — 오브젝트를 숨기는 신호 */
  isVisible: boolean;
};
