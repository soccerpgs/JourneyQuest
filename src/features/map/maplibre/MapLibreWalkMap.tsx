import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  NativeUserLocation,
  type CameraRef,
  type StyleSpecification,
  type TrackUserLocation,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/ui/theme';
import { FALLBACK_CENTER, FOLLOW_ZOOM, type WalkMapProps } from '../mapProps';
import { routeFeature } from '../routeGeoJson';
import { WalkwayHighlight } from './WalkwayHighlight';

interface Props extends WalkMapProps {
  mapStyle: string | StyleSpecification;
  /** OpenMapTiles 벡터 스타일일 때 보행로를 강조해서 덧그린다 */
  highlightWalkways?: boolean;
}

/** 따라가기 모드: 화면 중앙에 내 위치, 지도 방향(북쪽 위)은 유지 */
const FOLLOW_MODE: TrackUserLocation = 'default';

/** 실시간 추적 화면의 지도 (MapLibre). 내 위치를 따라가며 경로를 그린다. */
export function MapLibreWalkMap({
  segments,
  bottomInset = 0,
  locationGranted,
  mapStyle,
  highlightWalkways = false,
}: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const [tracking, setTracking] = useState<TrackUserLocation | undefined>(undefined);
  const [mapLoaded, setMapLoaded] = useState(false);
  const route = useMemo(() => routeFeature(segments), [segments]);

  // 지도 로딩 + 권한 허용이 모두 끝나면: 마지막으로 알려진 위치로 즉시 이동한 뒤 따라가기 시작
  useEffect(() => {
    if (!mapLoaded || !locationGranted) return;
    let cancelled = false;
    void (async () => {
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (cancelled) return;
      if (last) {
        cameraRef.current?.jumpTo({
          center: [last.coords.longitude, last.coords.latitude],
          zoom: FOLLOW_ZOOM,
        });
      }
      setTracking(FOLLOW_MODE);
    })();
    return () => {
      cancelled = true;
    };
  }, [mapLoaded, locationGranted]);

  const follow = () => {
    setTracking(FOLLOW_MODE);
    cameraRef.current?.zoomTo(FOLLOW_ZOOM, { duration: 500 });
  };

  return (
    <View style={styles.container}>
      <MapLibreMap
        style={styles.map}
        mapStyle={mapStyle}
        logo={false}
        compass
        attributionPosition={{ top: 8, left: 8 }}
        onDidFinishLoadingMap={() => setMapLoaded(true)}
        onRegionWillChange={(e) => {
          // 사용자가 지도를 직접 움직이면 따라가기 해제 → "내 위치" 버튼 표시
          if (e.nativeEvent.userInteraction) setTracking(undefined);
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: FALLBACK_CENTER, zoom: 14 }}
          trackUserLocation={tracking}
          padding={{ bottom: bottomInset }}
          onTrackUserLocationChange={(e) => setTracking(e.nativeEvent.trackUserLocation ?? undefined)}
        />
        {highlightWalkways && <WalkwayHighlight />}
        {locationGranted && <NativeUserLocation mode="heading" />}
        {route && (
          <GeoJSONSource id="live-route" data={route}>
            <Layer
              id="live-route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.route, 'line-width': 6, 'line-opacity': 0.9 }}
            />
          </GeoJSONSource>
        )}
      </MapLibreMap>

      {locationGranted && !tracking && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="현재 위치로 이동"
          onPress={follow}
          style={({ pressed }) => [styles.recenter, { bottom: bottomInset + spacing.lg }, pressed && styles.pressed]}
        >
          <Text style={styles.recenterText}>◎ 내 위치</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  recenter: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  recenterText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.7 },
});
