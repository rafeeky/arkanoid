import { describe, it, expect } from 'vitest';
import { AudioCueResolver } from './AudioCueResolver';
import { AudioCueTable } from '../definitions/tables/AudioCueTable';
import type { AudioCueEntry } from '../definitions/types/AudioCueEntry';

describe('AudioCueResolver — AudioCueTable 매핑 검증', () => {
  const resolver = new AudioCueResolver(AudioCueTable);

  it('EnteredTitle → cue_title_bgm (bgm)', () => {
    const cues = resolver.resolveCueIds('EnteredTitle');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.cueId).toBe('cue_title_bgm');
    expect(cues[0]!.playbackType).toBe('bgm');
    expect(cues[0]!.resourceId).toBe('bgm_title');
  });

  it('EnteredRoundIntro → cue_round_intro_jingle (jingle)', () => {
    const cues = resolver.resolveCueIds('EnteredRoundIntro');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.cueId).toBe('cue_round_intro_jingle');
    expect(cues[0]!.playbackType).toBe('jingle');
    expect(cues[0]!.resourceId).toBe('jingle_round_start');
  });

  it('BlockHit → cue_block_hit (sfx)', () => {
    const cues = resolver.resolveCueIds('BlockHit');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.cueId).toBe('cue_block_hit');
    expect(cues[0]!.playbackType).toBe('sfx');
  });

  it('BlockDestroyed → cue_block_destroyed (sfx)', () => {
    const cues = resolver.resolveCueIds('BlockDestroyed');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.cueId).toBe('cue_block_destroyed');
    expect(cues[0]!.playbackType).toBe('sfx');
  });

  it('ItemCollected → cue_item_collected (sfx)', () => {
    const cues = resolver.resolveCueIds('ItemCollected');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.cueId).toBe('cue_item_collected');
    expect(cues[0]!.playbackType).toBe('sfx');
  });

  it('LifeLost → cue_life_lost (sfx)', () => {
    const cues = resolver.resolveCueIds('LifeLost');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.cueId).toBe('cue_life_lost');
    expect(cues[0]!.playbackType).toBe('sfx');
  });

  it('EnteredGameOver → cue_gameover_jingle (jingle)', () => {
    const cues = resolver.resolveCueIds('EnteredGameOver');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.cueId).toBe('cue_gameover_jingle');
    expect(cues[0]!.playbackType).toBe('jingle');
  });

  it('UiConfirm → cue_ui_confirm (sfx)', () => {
    const cues = resolver.resolveCueIds('UiConfirm');
    expect(cues).toHaveLength(1);
    expect(cues[0]!.cueId).toBe('cue_ui_confirm');
    expect(cues[0]!.playbackType).toBe('sfx');
  });

  it('매핑 없는 이벤트는 빈 배열 반환', () => {
    expect(resolver.resolveCueIds('UnknownEvent')).toEqual([]);
    expect(resolver.resolveCueIds('')).toEqual([]);
    expect(resolver.resolveCueIds('BallLaunched')).toEqual([]);
  });

  it('커스텀 테이블로도 동작한다', () => {
    const customTable: AudioCueEntry[] = [
      { cueId: 'cue_a', eventType: 'EventA', resourceId: 'res_a', playbackType: 'sfx' },
      { cueId: 'cue_b1', eventType: 'EventB', resourceId: 'res_b1', playbackType: 'sfx' },
      { cueId: 'cue_b2', eventType: 'EventB', resourceId: 'res_b2', playbackType: 'jingle' },
    ];
    const customResolver = new AudioCueResolver(customTable);

    expect(customResolver.resolveCueIds('EventA')).toHaveLength(1);
    // 1:N 매핑도 지원
    const bCues = customResolver.resolveCueIds('EventB');
    expect(bCues).toHaveLength(2);
    expect(bCues.map((c) => c.cueId)).toContain('cue_b1');
    expect(bCues.map((c) => c.cueId)).toContain('cue_b2');
  });
});
