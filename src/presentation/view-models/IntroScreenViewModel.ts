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
  /** 현재 페이지 인덱스 (0..N-1). 렌더러가 페이지별 일러스트 키 결정에 사용. */
  pageIndex: number;
};
