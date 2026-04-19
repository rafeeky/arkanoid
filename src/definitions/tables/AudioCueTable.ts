import type { AudioCueEntry } from '../types/AudioCueEntry';

export const AudioCueTable: AudioCueEntry[] = [
  {
    cueId:        'cue_title_bgm',
    eventType:    'EnteredTitle',
    resourceId:   'bgm_title',
    playbackType: 'bgm',
  },
  {
    cueId:        'cue_round_intro_jingle',
    eventType:    'EnteredRoundIntro',
    resourceId:   'jingle_round_start',
    playbackType: 'jingle',
  },
  {
    cueId:        'cue_block_hit',
    eventType:    'BlockHit',
    resourceId:   'sfx_block_hit',
    playbackType: 'sfx',
  },
  {
    cueId:        'cue_block_destroyed',
    eventType:    'BlockDestroyed',
    resourceId:   'sfx_block_destroyed',
    playbackType: 'sfx',
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
];
