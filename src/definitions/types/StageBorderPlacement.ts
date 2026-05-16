import type { BorderOrientation } from '../../gameplay/state/BorderBlockState';

/**
 * Stage JSON 의 테두리 셀 한 칸 배치 정보.
 *
 * 좌표 표현은 grid 단위 (블럭 grid 와 별개의 테두리 grid). 실제 픽셀 좌표는
 * StageRuntimeFactory 가 계산한다.
 *
 * horizontal: 상단 테두리. row=0 고정, col=0..N (BORDER_LENGTH 단위)
 * vertical:   좌/우 테두리. col=0(좌) 또는 col=last(우) 고정, row=0..N (BORDER_LENGTH 단위)
 */
export type StageBorderPlacement = {
  row: number;
  col: number;
  orientation: BorderOrientation;
};
