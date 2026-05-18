import type Phaser from 'phaser';
import type { GameplayRuntimeState } from '../../gameplay/state/GameplayRuntimeState';
import type { HudViewModel } from '../view-models/HudViewModel';
import type { BlockDefinition } from '../../definitions/types/BlockDefinition';
import type { SpinnerDefinition } from '../../definitions/types/SpinnerDefinition';
import type { ScreenState } from '../state/ScreenState';

import {
  type HudObjects, createHudObjects, renderHud, hideHud,
} from './inGame/renderHud';
import {
  type BarObjects, createBarObjects, renderBar, hideBar,
} from './inGame/renderBar';
import {
  type BallObjects, createBallObjects, renderBall, hideBall,
} from './inGame/renderBall';
import {
  type BlocksObjects, createBlocksObjects, renderBlocks, hideBlocks,
} from './inGame/renderBlocks';
import {
  type ItemsObjects, createItemsObjects, renderItems, hideItems,
} from './inGame/renderItems';
import {
  type LasersObjects, createLasersObjects, renderLasers, hideLasers,
} from './inGame/renderLasers';
import {
  type SpinnersObjects, createSpinnersObjects, renderSpinners, hideSpinners,
} from './inGame/renderSpinners';
import {
  type BordersObjects, createBordersObjects, renderBorders, hideBorders,
} from './inGame/renderBorders';
import {
  type MascotObjects, type CheerMascot,
  createMascotObjects, renderMascot, hideMascot,
} from './inGame/renderMascot';
import {
  type SliderObjects, createSliderObjects, renderSlider, hideSlider,
} from './inGame/renderSlider';
import {
  type ToastObjects, createToastObjects, renderToast, hideToast,
} from './inGame/renderToast';

/**
 * InGame 화면 렌더링 합성 layer.
 *
 * 각 sub-renderer (renderer/inGame/*) 가 자기 책임만 담당.
 * 이 파일은 sub-renderer 들의 인스턴스를 묶고 orchestration 만 수행.
 *
 * 외부 API (createInGameObjects, renderInGameScreen, hideInGameScreen, InGameObjects) 는
 * SceneRenderer 가 의존하므로 그대로 유지.
 */

export type InGameObjects = {
  hud: HudObjects;
  bar: BarObjects;
  ball: BallObjects;
  blocks: BlocksObjects;
  items: ItemsObjects;
  lasers: LasersObjects;
  spinners: SpinnersObjects;
  borders: BordersObjects;
  mascot: MascotObjects;
  slider: SliderObjects;
  toast: ToastObjects;
};

export function createInGameObjects(
  scene: Phaser.Scene,
  handlers: { onPauseClick?: () => void } = {},
): InGameObjects {
  return {
    hud:      createHudObjects(scene, handlers.onPauseClick),
    bar:      createBarObjects(scene),
    ball:     createBallObjects(scene),
    blocks:   createBlocksObjects(scene),
    items:    createItemsObjects(),
    lasers:   createLasersObjects(),
    spinners: createSpinnersObjects(),
    borders:  createBordersObjects(),
    mascot:   createMascotObjects(scene),
    slider:   createSliderObjects(scene),
    toast:    createToastObjects(scene),
  };
}

export function renderInGameScreen(
  scene: Phaser.Scene,
  objects: InGameObjects,
  gameplayState: Readonly<GameplayRuntimeState>,
  hudViewModel: HudViewModel,
  blockDefinitions: Readonly<Record<string, BlockDefinition>>,
  spinnerDefinitions: Readonly<Record<string, SpinnerDefinition>>,
  screenState: Readonly<ScreenState>,
  barBreakProgress: number,
  /** RoundIntro READY 깜빡 연출용 (0.0..1.0). 미지정/1.0 이면 기존 동작. */
  barAlphaOverride: number = 1,
  /** 공 발사 궤적 시뮬레이션용. 미지정 시 궤적 숨김. */
  ballConfig?: { ballInitialSpeed: number; ballInitialAngleDeg: number },
  /** 응원 mascot 정보. 미지정 시 숨김. */
  cheerMascot?: CheerMascot,
): void {
  renderHud(objects.hud, hudViewModel);
  renderBar(objects.bar, gameplayState.bar, barAlphaOverride, screenState.isBarBreaking, barBreakProgress);
  renderBall(objects.ball, gameplayState.balls[0], screenState.isBarBreaking, ballConfig);
  renderBlocks(scene, objects.blocks, gameplayState.blocks, blockDefinitions, new Set(screenState.blockHitFlashBlockIds));
  renderItems(scene, objects.items, gameplayState.itemDrops);
  renderLasers(scene, objects.lasers, gameplayState.laserShots);
  renderSpinners(scene, objects.spinners, gameplayState.spinnerStates, spinnerDefinitions);
  renderBorders(scene, objects.borders, gameplayState.borders, gameplayState.doors);
  renderMascot(objects.mascot, cheerMascot);
  renderSlider(objects.slider, gameplayState, cheerMascot?.id);
  renderToast(objects.toast, gameplayState.bar);
}

export function hideInGameScreen(objects: InGameObjects): void {
  hideHud(objects.hud);
  hideBar(objects.bar);
  hideBall(objects.ball);
  hideBlocks(objects.blocks);
  hideItems(objects.items);
  hideLasers(objects.lasers);
  hideSpinners(objects.spinners);
  hideBorders(objects.borders);
  hideMascot(objects.mascot);
  hideSlider(objects.slider);
  hideToast(objects.toast);
}
