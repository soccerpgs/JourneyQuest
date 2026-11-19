import { StyleSheet, View } from 'react-native';
import type { RouteMapProps } from './mapProps';
import { useMapProvider } from './mapProvider';
import { MapProviderSelect } from './MapProviderSelect';
import { loadMapLibre } from './maplibre/loadMapLibre';
import { MapLibreUnavailableNotice } from './maplibre/MapLibreUnavailableNotice';

/** 저장된 걷기 기록의 경로 지도. 선택된 지도로 그린다. */
export function RouteMap(props: RouteMapProps) {
  const provider = useMapProvider((s) => s.provider);
  // MapLibre는 정적 import 금지: 네이티브 모듈이 없는 예전 빌드에서 import만 해도 앱이 죽는다
  const ml = loadMapLibre();
  if (ml && provider === 'osm') ml.ensureOsmUserAgent();

  return (
    <View style={styles.container}>
      {!ml && <MapLibreUnavailableNotice />}
      {ml && provider === 'maplibre' && (
        <ml.MapLibreRouteMap key="maplibre" {...props} mapStyle={ml.OPENFREEMAP_STYLE_URL} highlightWalkways />
      )}
      {ml && provider === 'osm' && <ml.MapLibreRouteMap key="osm" {...props} mapStyle={ml.OSM_RASTER_STYLE} />}
      <MapProviderSelect style={styles.select} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  select: { position: 'absolute', top: 8, left: 8 },
});
