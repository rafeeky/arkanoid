/**
 * PowerupTable — 파워업 시각 토큰의 SSOT.
 *
 * 색·아이콘 키·라벨이 *여기 한 곳* 에서 정의됨.
 * 토스트 / HUD 잔량 카운터 / 타이틀 파워업 패널 등 모두 이 테이블 참조.
 *
 * 색은 *블록 PNG 톤* 과 맞춤 (플레이어가 보는 블록 색이 기준점):
 * - expand: 주황 (block_basic_drop 톤)
 * - magnet: 파랑 (block_magnet_drop 톤)
 * - laser:  빨강 (block_laser_drop 톤)
 *
 * Unity 포팅 시 ScriptableObject 한 장으로 매핑.
 */

export type PowerupId = 'expand' | 'magnet' | 'laser';

export type PowerupToken = {
  /** 16진수 색 (Phaser Graphics.fillStyle 용 number). */
  color: number;
  /** 아이콘 텍스처 키 — renderBlocks.ts:ensureIconTextures 에서 코드 generateTexture. */
  iconKey: string;
  /** 라벨 (대문자, 느낌표 없음). 토스트는 `${label}!` 식으로 표시. */
  label: string;
};

export const POWERUP_TABLE: Record<PowerupId, PowerupToken> = {
  expand: { color: 0xff9933, iconKey: 'icon_expand', label: 'EXPAND' },
  magnet: { color: 0x88ccff, iconKey: 'icon_magnet', label: 'MAGNET' },
  laser:  { color: 0xff8888, iconKey: 'icon_laser',  label: 'LASER'  },
};

/** number 색 → '#rrggbb' string (Phaser Text.setColor 용). */
export function colorToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
