import { AssetCatalog } from './AssetCatalog';

/**
 * AssetResolver — resourceId를 실제 파일 경로로 해석.
 *
 * AssetCatalog를 래핑하여 안전한 조회 인터페이스를 제공한다.
 * 매핑이 없으면 null을 반환하고 경고를 출력한다.
 *
 * Unity 매핑: AssetLoader / AddressablesHelper 어댑터에 해당.
 * 이 클래스는 게임 규칙이나 사용 맥락을 모른다 — 경로 해석만 담당.
 */
export class AssetResolver {
  private readonly catalog: Readonly<Record<string, string>>;

  constructor(catalog: Readonly<Record<string, string>> = AssetCatalog) {
    this.catalog = catalog;
  }

  /**
   * resourceId에 해당하는 파일 경로를 반환한다.
   * 등록되지 않은 resourceId이면 null을 반환하고 경고를 출력한다.
   */
  resolve(resourceId: string): string | null {
    const path = this.catalog[resourceId];
    if (path === undefined) {
      console.warn(`[AssetResolver] resourceId '${resourceId}'에 대한 경로가 없습니다.`);
      return null;
    }
    return path;
  }
}
