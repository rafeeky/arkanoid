export type AudioCueEntry = {
  cueId: string;
  eventType: string;
  resourceId: string;
  playbackType: 'bgm' | 'jingle' | 'sfx';
  /**
   * 재생 시 적용할 피치 배율 (Phaser sound rate, 1.0 = 기본).
   * 0.7 = 저음, 1.35 = 고음. 생략 시 1.0.
   */
  pitch?: number;
  /**
   * 재생 길이 강제 컷 (ms). 지정 시 해당 시간 후 sound.stop() 호출 (Phase 3).
   * 바-공 충돌음 같은 짧은 1음절 효과음을 긴 파일에서 잘라 쓰기 위해 사용.
   * Unity 매핑: AudioSource.PlayScheduled(duration). 웹: setTimeout 기반.
   */
  playDurationMs?: number;
  /**
   * 음량 (0..1). 미지정 시 1 (기본).
   * Unity 매핑: AudioSource.volume.
   */
  volume?: number;
};
