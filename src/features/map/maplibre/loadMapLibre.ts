import { isMapLibreAvailable } from './availability';

type MapLibreModule = typeof import('./index');

/** MapLibre 구현을 처음 필요할 때 불러온다. 네이티브 모듈이 없는 빌드면 null. */
export function loadMapLibre(): MapLibreModule | null {
  if (!isMapLibreAvailable) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./index') as MapLibreModule;
}
