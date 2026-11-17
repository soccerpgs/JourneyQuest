import { Camera, LineLayer, LocationPuck, MapView, ShapeSource, Viewport } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteSegment } from '@/features/tracking/trackingStore';
import { colors, radius, spacing } from '@/ui/theme';
import { MAP_STYLE_URL, ensureMapboxInitialized } from './mapbox';
import { MissingTokenNotice } from './MissingTokenNotice';
import { routeFeature } from './routeGeoJson';

interface Props {
  segments: readonly RouteSegment[];
  /** 하단 패널에 가려지지 않도록 사용자 위치를 위로 올리는 여백 */
  bottomInset?: number;
  /** 위치 권한이 허용되었는지. true 가 되는 시점에 내 위치로 카메라를 옮긴다 */
  locationGranted: boolean;
}

type ViewportHandle = React.ComponentRef<typeof Viewport>;
type CameraHandle = React.ComponentRef<typeof Camera>;

/** 위치를 모를 때의 초기 화면 (서울시청). 위도·경도 0(아프리카 앞바다)으로 시작하지 않도록 */
const FALLBACK_CENTER: [number, number] = [126.978, 37.5665];
const FOLLOW_ZOOM = 16;
/** 내 위치(puck)가 아직 준비되지 않아 따라가기 전환이 실패할 때 재시도 */
const FOLLOW_RETRY_MS = 1500;
const FOLLOW_MAX_RETRIES = 5;

/** 실시간 추적 화면의 지도: 사용자 위치를 따라가며 경로를 그린다 */
export function WalkMap({ segments, bottomInset = 0, locationGranted }: Props) {
  const viewportRef = useRef<ViewportHandle>(null);
  const cameraRef = useRef<CameraHandle>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [following, setFollowing] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const route = useMemo(() => routeFeature(segments), [segments]);

  const follow = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setFollowing(true);

    const attempt = (n: number) => {
      const retry = () => {
        if (n < FOLLOW_MAX_RETRIES) retryTimer.current = setTimeout(() => attempt(n + 1), FOLLOW_RETRY_MS);
      };
      const viewport = viewportRef.current;
      if (!viewport) return retry();
      viewport
        .transitionTo(
          {
            kind: 'followPuck',
            options: { zoom: FOLLOW_ZOOM, pitch: 0, bearing: 'keep', padding: { bottom: bottomInset } },
          },
          { kind: 'default', maxDurationMs: 800 },
        )
        .then((ok) => {
          if (!ok) retry();
        })
        .catch(retry);
    };
    attempt(0);
  }, [bottomInset]);

  // 지도 로딩 + 권한 허용이 모두 끝나면: 마지막으로 알려진 위치로 즉시 이동한 뒤 따라가기 시작
  useEffect(() => {
    if (!mapLoaded || !locationGranted) return;
    let cancelled = false;
    void (async () => {
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (cancelled) return;
      if (last) {
        cameraRef.current?.setCamera({
          centerCoordinate: [last.coords.longitude, last.coords.latitude],
          zoomLevel: FOLLOW_ZOOM,
          animationDuration: 0,
        });
      }
      follow();
    })();
    return () => {
      cancelled = true;
    };
  }, [mapLoaded, locationGranted, follow]);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  if (!ensureMapboxInitialized()) return <MissingTokenNotice />;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        styleURL={MAP_STYLE_URL}
        scaleBarEnabled={false}
        compassEnabled
        logoPosition={{ top: 8, left: 8 }}
        attributionPosition={{ top: 8, left: 92 }}
        onDidFinishLoadingMap={() => setMapLoaded(true)}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: FALLBACK_CENTER, zoomLevel: 14 }}
        />
        <Viewport
          ref={viewportRef}
          onStatusChanged={(e) => {
            if (e.to.kind === 'idle' && e.reason === 'UserInteraction') setFollowing(false);
          }}
        />
        <LocationPuck puckBearingEnabled puckBearing="heading" pulsing={{ isEnabled: true }} />
        {route && (
          <ShapeSource id="live-route" shape={route}>
            <LineLayer
              id="live-route-line"
              style={{
                lineColor: colors.route,
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.9,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {!following && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="현재 위치로 이동"
          onPress={follow}
          style={({ pressed }) => [
            styles.recenter,
            { bottom: bottomInset + spacing.lg },
            pressed && styles.pressed,
          ]}
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
