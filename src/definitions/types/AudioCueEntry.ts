export type AudioCueEntry = {
  cueId: string;
  eventType: string;
  resourceId: string;
  playbackType: 'bgm' | 'jingle' | 'sfx';
};
