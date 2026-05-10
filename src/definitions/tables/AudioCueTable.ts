import type { AudioCueEntry } from '../types/AudioCueEntry';

/**
 * 이벤트-사운드 cue 매핑 테이블.
 * Unity 묶음 A 와 동일하게 피치 분기 + 새 cue (BallLaunched / BallHitBar / ItemCollected_*) 포함.
 */
export const AudioCueTable: AudioCueEntry[] = [
  {
    cueId:        'cue_title_bgm',
    eventType:    'EnteredTitle',
    resourceId:   'bgm_title',
    playbackType: 'bgm',
    volume:       0.2,    // 신나는 BGM 을 기본의 20% 볼륨으로 깔기.
  },
  {
    cueId:        'cue_round_intro_jingle',
    eventType:    'EnteredRoundIntro',
    resourceId:   'jingle_round_start',
    playbackType: 'jingle',
  },
  // 벽돌 타격음: 더 높은 피치로 경쾌하게 (Phase 3: 1.35 → 1.6, 더 삡삡거리는 톤)
  {
    cueId:        'cue_block_hit',
    eventType:    'BlockHit',
    resourceId:   'sfx_block_hit',
    playbackType: 'sfx',
    pitch:        1.6,
  },
  {
    cueId:        'cue_block_destroyed',
    eventType:    'BlockDestroyed',
    resourceId:   'sfx_block_destroyed',
    playbackType: 'sfx',
    pitch:        1.4,
  },
  {
    cueId:        'cue_item_collected',
    eventType:    'ItemCollected',
    resourceId:   'sfx_item_collected',
    playbackType: 'sfx',
  },
  {
    cueId:        'cue_life_lost',
    eventType:    'LifeLost',
    resourceId:   'sfx_life_lost',
    playbackType: 'sfx',
  },
  {
    cueId:        'cue_gameover_jingle',
    eventType:    'EnteredGameOver',
    resourceId:   'jingle_gameover',
    playbackType: 'jingle',
  },
  {
    cueId:        'cue_ui_confirm',
    eventType:    'UiConfirm',
    resourceId:   'sfx_ui_confirm',
    playbackType: 'sfx',
  },
  {
    cueId:        'cue_gameclear_jingle',
    eventType:    'EnteredGameClear',
    resourceId:   'jingle_gameclear',
    playbackType: 'jingle',
  },
  {
    cueId:        'cue_ball_attached',
    eventType:    'BallAttached',
    resourceId:   'sfx_ball_attached',
    playbackType: 'sfx',
  },
  {
    cueId:        'cue_balls_released',
    eventType:    'BallsReleased',
    resourceId:   'sfx_balls_released',
    playbackType: 'sfx',
  },
  {
    cueId:        'cue_laser_fired',
    eventType:    'LaserFired',
    resourceId:   'sfx_laser_fired',
    playbackType: 'sfx',
  },

  // 묶음 A 추가 — 공 발사 + 바 반사 + 아이템 타입별 획득 사운드
  // 공 발사 (초기 발사): 기본 피치
  {
    cueId:        'cue_ball_launch',
    eventType:    'BallLaunched',
    resourceId:   'sfx_balls_released',
    playbackType: 'sfx',
    pitch:        1.0,
  },
  // 바 반사음 — 1음절 "삡". User feedback: 110ms 도 여전히 2음절스러움 → 60ms 로 더 strict cut.
  {
    cueId:        'cue_ball_hit_bar',
    eventType:    'BallHitBar',
    resourceId:   'sfx_balls_released',
    playbackType: 'sfx',
    pitch:        0.85,
    playDurationMs: 60,
  },
  {
    cueId:        'cue_item_bar_extend',
    eventType:    'ItemCollected_Expand',
    resourceId:   'sfx_item_collected',
    playbackType: 'sfx',
  },
  {
    cueId:        'cue_item_laser',
    eventType:    'ItemCollected_Laser',
    resourceId:   'sfx_laser_fired',
    playbackType: 'sfx',
  },
  {
    cueId:        'cue_item_magnet',
    eventType:    'ItemCollected_Magnet',
    resourceId:   'sfx_ball_attached',
    playbackType: 'sfx',
  },
];
