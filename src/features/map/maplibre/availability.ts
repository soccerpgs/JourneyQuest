import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * 설치된 앱(네이티브 바이너리)에 MapLibre 모듈이 들어 있는지.
 * MapLibre 추가 전에 만든 개발 빌드에 새 JS를 불러오면 false.
 * ⚠️ 이 파일은 '@maplibre/maplibre-react-native'를 import하면 안 된다. import만 해도 네이티브 모듈을 찾다가 앱이 죽는다.
 */
export const isMapLibreAvailable = TurboModuleRegistry.get<TurboModule>('MLRNCameraModule') != null;
