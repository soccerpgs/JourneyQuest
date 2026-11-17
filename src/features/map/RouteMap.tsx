import { Camera, CircleLayer, LineLayer, MapView, ShapeSource } from '@rnmapbox/maps';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TrackPoint } from '@/features/tracking/types';
import { boundsOf } from '@/lib/geo';
import { colors } from '@/ui/theme';
import { MAP_STYLE_URL, ensureMapboxInitialized } from './mapbox';
import { MissingTokenNotice } from './MissingTokenNotice';
import { endpointsFeature, routeFeature, segmentsFromPoints } from './routeGeoJson';

interface Props {
  points: readonly TrackPoint[];
}

/** 저장된 걷기 기록의 전체 경로를 보여주는 정적 지도 */
export function RouteMap({ points }: Props) {
  const route = useMemo(() => routeFeature(segmentsFromPoints(points)), [points]);
  const endpoints = useMemo(() => endpointsFeature(points), [points]);
  const bounds = useMemo(() => boundsOf(points), [points]);

  if (!ensureMapboxInitialized()) return <MissingTokenNotice />;
  if (!bounds) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>기록된 경로가 없습니다</Text>
      </View>
    );
  }

  return (
    <MapView style={styles.map} styleURL={MAP_STYLE_URL} scaleBarEnabled={false}>
      <Camera
        bounds={{ ...bounds, paddingTop: 48, paddingBottom: 48, paddingLeft: 40, paddingRight: 40 }}
        maxZoomLevel={17}
        animationDuration={0}
      />
      {route && (
        <ShapeSource id="history-route" shape={route}>
          <LineLayer
            id="history-route-line"
            style={{ lineColor: colors.route, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
          />
        </ShapeSource>
      )}
      <ShapeSource id="history-endpoints" shape={endpoints}>
        <CircleLayer
          id="history-endpoints-circle"
          style={{
            circleRadius: 7,
            circleColor: ['match', ['get', 'kind'], 'start', colors.routeStart, colors.routeEnd],
            circleStrokeColor: '#FFFFFF',
            circleStrokeWidth: 2,
          }}
        />
      </ShapeSource>
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  emptyText: { color: colors.textMuted },
});
