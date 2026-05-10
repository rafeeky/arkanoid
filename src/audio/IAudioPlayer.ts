import type { AudioCueEntry } from '../definitions/types/AudioCueEntry';

/**
 * IAudioPlayer — 오디오 재생 추상화 인터페이스.
 *
 * Audio Playback 계층의 핵심 계약.
 * 구현체: NoopAudioPlayer (테스트/헤드리스), PhaserAudioPlayer (브라우저).
 *
 * Unity 매핑: AudioSource Adapter 인터페이스에 대응.
 */
export interface IAudioPlayer {
  /**
   * 주어진 cue를 재생한다.
   * playbackType에 따라 bgm/jingle/sfx 로직이 분기된다.
   * BGM/SFX 음소거 상태이면 해당 카테고리는 재생 스킵.
   */
  play(cue: AudioCueEntry): void;

  /** 현재 재생 중인 모든 소리를 정지한다. */
  stopAll(): void;

  /**
   * 특정 cueId 의 사운드만 정지한다 (Phase 2).
   * RoundIntro 짧은 BGM 을 InGame 진입 시 끊기 위해 사용.
   * 매핑이 없거나 재생 중이 아니면 no-op.
   */
  stop(cueId: string): void;

  /** 배경음(BGM) 음소거 토글. true 시 BGM 재생 스킵 + 현재 재생 중이면 정지. */
  setBgmMuted(muted: boolean): void;
  /** 효과음(jingle/sfx) 음소거 토글. true 시 해당 카테고리 재생 스킵. */
  setSfxMuted(muted: boolean): void;
  /** 현재 BGM 음소거 상태. */
  isBgmMuted(): boolean;
  /** 현재 SFX 음소거 상태. */
  isSfxMuted(): boolean;
}
