/**
 * MapLibre 구현 모음. 이 모듈은 isMapLibreAvailable 확인 후 loadMapLibre()로만 불러온다.
 * (정적 import 하면 MapLibre가 없는 빌드에서 앱 시작 시 크래시)
 */
export { MapLibreRouteMap } from './MapLibreRouteMap';
export { MapLibreWalkMap } from './MapLibreWalkMap';
export { OPENFREEMAP_STYLE_URL, OSM_RASTER_STYLE, ensureOsmUserAgent } from './styles';
