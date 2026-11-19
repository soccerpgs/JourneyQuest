import { Camera, GeoJSONSource, Layer, Map as MapLibreMap, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { boundsOf } from '@/lib/geo';
import { colors } from '@/ui/theme';
import type { RouteMapProps } from '../mapProps';
import { endpointsFeature, routeFeature, segmentsFromPoints } from '../routeGeoJson';
import { WalkwayHighlight } from './WalkwayHighlight';

interface Props extends RouteMapProps {
  mapStyle: string | StyleSpecification;
  highlightWalkways?: boolean;
}

/** 저장된 걷기 기록의 전체 경로를 보여주는 정적 지도 (MapLibre) */
export function MapLibreRouteMap({ points, mapStyle, highlightWalkways = false }: Props) {
  const route = useMemo(() => routeFeature(segmentsFromPoints(points)), [points]);
  const endpoints = useMemo(() => endpointsFeature(points), [points]);
  const bounds = useMemo(() => boundsOf(points), [points]);

  if (!bounds) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>기록된 경로가 없습니다</Text>
      </View>
    );
  }

  return (
    <MapLibreMap style={styles.map} mapStyle={mapStyle} logo={false} attributionPosition={{ bottom: 8, right: 8 }}>
      <Camera
        // MapLibre는 [서, 남, 동, 북] 순서. boundsOf 는 { ne, sw } 형태를 돌려준다.
        initialViewState={{
          bounds: [bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]],
          padding: { top: 48, bottom: 48, left: 40, right: 40 },
        }}
        maxZoom={17}
      />
      {highlightWalkways && <WalkwayHighlight />}
      {route && (
        <GeoJSONSource id="history-route" data={route}>
          <Layer
            id="history-route-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.route, 'line-width': 5 }}
          />
        </GeoJSONSource>
      )}
      <GeoJSONSource id="history-endpoints" data={endpoints}>
        <Layer
          id="history-endpoints-circle"
          type="circle"
          paint={{
            'circle-radius': 7,
            'circle-color': ['match', ['get', 'kind'], 'start', colors.routeStart, colors.routeEnd],
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2,
          }}
        />
      </GeoJSONSource>
    </MapLibreMap>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  emptyText: { color: colors.textMuted },
});
