import { StyleSheet, View } from 'react-native';
import type { WalkMapProps } from './mapProps';
import { useMapProvider } from './mapProvider';
import { MapProviderSelect } from './MapProviderSelect';
import { loadMapLibre } from './maplibre/loadMapLibre';
import { MapLibreUnavailableNotice } from './maplibre/MapLibreUnavailableNotice';

/** 실시간 추적 화면의 지도. 선택된 지도(1 MapLibre / 2 OSM)로 그린다. */
export function WalkMap(props: WalkMapProps) {
  const provider = useMapProvider((s) => s.provider);
  // MapLibre는 정적 import 금지: 네이티브 모듈이 없는 예전 빌드에서 import만 해도 앱이 죽는다
  const ml = loadMapLibre();
  if (ml && provider === 'osm') ml.ensureOsmUserAgent();

  return (
    <View style={styles.container}>
      {!ml && <MapLibreUnavailableNotice />}
      {/* key: 지도를 바꾸면 네이티브 뷰를 새로 만든다 */}
      {ml && provider === 'maplibre' && (
        <ml.MapLibreWalkMap key="maplibre" {...props} mapStyle={ml.OPENFREEMAP_STYLE_URL} highlightWalkways />
      )}
      {ml && provider === 'osm' && <ml.MapLibreWalkMap key="osm" {...props} mapStyle={ml.OSM_RASTER_STYLE} />}
      {/* 왼쪽 위 저작자 표시(top 8) 아래에 둔다 */}
      <MapProviderSelect style={styles.select} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  select: { position: 'absolute', top: 44, left: 8 },
});
