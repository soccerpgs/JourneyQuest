import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

/**
 * 지도 렌더러는 둘 다 MapLibre. 차이는 타일·스타일(내용물)이다.
 * (Mapbox는 @rnmapbox/maps 와 MapLibre의 네이티브 모듈 이름이 충돌해 함께 빌드할 수 없어 제거함)
 */
export type MapProvider = 'maplibre' | 'osm';

export interface MapProviderOption {
  id: MapProvider;
  label: string;
  description: string;
}

export const MAP_PROVIDERS: readonly MapProviderOption[] = [
  { id: 'maplibre', label: 'MapLibre', description: 'OpenFreeMap 벡터 지도 · 보행로 강조' },
  { id: 'osm', label: 'OpenStreetMap', description: 'OSM 표준 타일 · 보행로 점선 · 개발 비교용' },
];

const DEFAULT_PROVIDER: MapProvider = 'maplibre';
const STORAGE_KEY = 'map.provider';

function isMapProvider(value: unknown): value is MapProvider {
  return MAP_PROVIDERS.some((p) => p.id === value);
}

/** 저장된 선택이 없거나 지금은 없는 값(예: 예전의 'mapbox')이면 기본값 */
function loadInitial(): MapProvider {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    if (isMapProvider(saved)) return saved;
  } catch {
    // 저장소를 못 읽어도 지도는 떠야 하므로 기본값 사용
  }
  return DEFAULT_PROVIDER;
}

interface MapProviderState {
  provider: MapProvider;
  setProvider: (provider: MapProvider) => void;
}

/** 지도 제공자 선택. 앱을 다시 켜도 유지되도록 SQLite key-value 저장소에 보관한다. */
export const useMapProvider = create<MapProviderState>((set) => ({
  provider: loadInitial(),
  setProvider: (provider) => {
    set({ provider });
    try {
      Storage.setItemSync(STORAGE_KEY, provider);
    } catch {
      // 저장 실패 시 이번 실행 동안만 유지
    }
  },
}));
