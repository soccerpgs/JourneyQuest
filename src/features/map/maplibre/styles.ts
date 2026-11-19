import { TransformRequestManager, type StyleSpecification } from '@maplibre/maplibre-react-native';

/**
 * 2번 MapLibre: OpenFreeMap "liberty" 벡터 스타일 (API 키 없음, OpenMapTiles 스키마).
 * 이 스타일은 보행로(`class=path`)를 흰색 점선으로 그려 잘 안 보이므로 WALKWAY_HIGHLIGHT 레이어를 덧그린다.
 */
export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** liberty 스타일의 벡터 소스 id와 보행로 레이어 id (스타일 JSON에서 확인) */
export const OPENMAPTILES_SOURCE_ID = 'openmaptiles';
export const LIBERTY_PATH_LAYER_ID = 'road_path_pedestrian';

/**
 * 3번 OpenStreetMap: OSM 표준(Carto) 래스터 타일. z16 이상에서 보행로를 점선으로 그린다.
 * ⚠️ OSMF 타일 정책상 출시 앱·오프라인 저장에는 쓸 수 없다. 개발 중 비교용.
 *    https://operations.osmfoundation.org/policies/tiles/
 */
export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-raster', type: 'raster', source: 'osm' }],
};

let osmHeaderAdded = false;

/** OSM 타일 서버는 앱을 식별할 수 있는 User-Agent를 요구한다 (라이브러리 기본값은 차단 대상) */
export function ensureOsmUserAgent() {
  if (osmHeaderAdded) return;
  osmHeaderAdded = true;
  try {
    TransformRequestManager.addHeader({
      id: 'osm-user-agent',
      name: 'User-Agent',
      value: 'JourneyQuest/1.0 (React Native; MapLibre)',
      match: /^https:\/\/tile\.openstreetmap\.org\//,
    });
  } catch {
    osmHeaderAdded = false;
  }
}
