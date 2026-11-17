import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WalkMap } from '@/features/map/WalkMap';
import { expoLocationProvider } from '@/features/tracking/location/expoLocationProvider';
import { useTrackingStore } from '@/features/tracking/trackingStore';
import { useLiveMetrics } from '@/features/tracking/useLiveMetrics';
import {
  continueInterruptedWalk,
  discardWalk,
  finishWalk,
  onAppForeground,
  pauseWalk,
  restoreActiveWalk,
  resumeWalk,
  startWalk,
} from '@/features/tracking/walkController';
import { formatDuration, formatKm, formatPace } from '@/lib/format';
import { Button } from '@/ui/Button';
import { StatGrid } from '@/ui/StatGrid';
import { colors, radius, spacing } from '@/ui/theme';

/** 이 거리 미만이면 종료 시 "기록 삭제"를 함께 제안 */
const SHORT_WALK_M = 10;

/** 앱 프로세스당 한 번만 복구 */
let restoreAttempted = false;

export default function WalkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const segments = useTrackingStore((s) => s.segments);
  const lastFix = useTrackingStore((s) => s.lastFix);
  const metrics = useLiveMetrics();
  const [busy, setBusy] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const [locationGranted, setLocationGranted] = useState(false);
  const mounted = useRef(true);
  /** 버튼 연타로 같은 동작이 겹쳐 실행되지 않도록 */
  const inFlight = useRef(false);

  const run = async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const askToContinue = () => {
    Alert.alert(
      '진행 중이던 걷기가 있습니다',
      '앱이 종료되어 기록이 중단되었습니다. 꺼져 있던 시간은 일시정지로 처리됩니다.',
      [
        { text: '종료하고 저장', onPress: () => void run(saveAndOpen) },
        { text: '이어서 기록', style: 'default', onPress: () => void run(continueInterruptedWalk) },
      ],
      { cancelable: false },
    );
  };

  const saveAndOpen = async () => {
    const id = await finishWalk();
    if (id) router.push({ pathname: '/history/[id]', params: { id } });
  };

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      // 지도에 현재 위치를 보여주기 위해 먼저 권한을 요청
      const granted = await expoLocationProvider.ensurePermission().catch(() => false);
      if (mounted.current) setLocationGranted(granted);
      if (restoreAttempted) return;
      restoreAttempted = true;
      const result = await restoreActiveWalk();
      if (result.kind === 'interrupted') askToContinue();
    })();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') onAppForeground();
    });
    return () => {
      mounted.current = false;
      sub.remove();
    };
    // 마운트 시 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStart = () =>
    run(async () => {
      const result = await startWalk();
      if (result === 'started') setLocationGranted(true);
      if (result === 'permission-denied') {
        Alert.alert(
          '위치 권한이 필요합니다',
          '걷기 경로를 기록하려면 위치 접근을 허용해 주세요.',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => void Linking.openSettings() },
          ],
        );
      }
    });

  const onFinish = () => {
    const buttons: Parameters<typeof Alert.alert>[2] = [{ text: '계속 걷기', style: 'cancel' }];
    if ((metrics?.distanceM ?? 0) < SHORT_WALK_M) {
      buttons.push({ text: '기록 삭제', style: 'destructive', onPress: () => void run(discardWalk) });
    }
    buttons.push({ text: '종료하고 저장', onPress: () => void run(saveAndOpen) });
    Alert.alert('걷기를 종료할까요?', undefined, buttons);
  };

  const statusLabel = !metrics
    ? null
    : metrics.status === 'paused'
      ? '일시정지'
      : metrics.autoPaused
        ? '자동 일시정지 · 움직이면 다시 기록됩니다'
        : '기록 중';

  return (
    <View style={styles.container}>
      <WalkMap segments={segments} bottomInset={panelHeight} locationGranted={locationGranted} />

      {metrics && lastFix?.accuracy != null && (
        <View style={styles.gpsBadge} accessibilityLabel={`GPS 정확도 ${Math.round(lastFix.accuracy)}미터`}>
          <View style={[styles.gpsDot, { backgroundColor: gpsColor(lastFix.accuracy) }]} />
          <Text style={styles.gpsText}>GPS ±{Math.round(lastFix.accuracy)}m</Text>
        </View>
      )}

      <View
        style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}
        onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
      >
        {metrics ? (
          <>
            {statusLabel && (
              <Text
                style={[styles.status, metrics.status === 'tracking' && !metrics.autoPaused && styles.statusActive]}
              >
                {statusLabel}
              </Text>
            )}
            <StatGrid
              hero={{ label: '거리', value: formatKm(metrics.distanceM), unit: 'km' }}
              items={[
                { label: '시간', value: formatDuration(metrics.movingMs) },
                { label: '평균 페이스', value: formatPace(metrics.averagePace) },
                { label: '현재 페이스', value: formatPace(metrics.currentPace) },
                { label: '걸음', value: metrics.steps.toLocaleString() },
                { label: '칼로리', value: String(Math.round(metrics.calories)), unit: 'kcal' },
              ]}
            />
            <View style={styles.controls}>
              {metrics.status === 'paused' ? (
                <Button label="재개" onPress={() => void run(resumeWalk)} disabled={busy} />
              ) : (
                <Button label="일시정지" variant="secondary" onPress={() => void run(pauseWalk)} disabled={busy} />
              )}
              <Button label="종료" variant="danger" onPress={onFinish} disabled={busy} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.idleTitle}>걸을 준비가 되셨나요?</Text>
            <Text style={styles.idleBody}>시작을 누르면 화면을 꺼도 경로가 계속 기록됩니다.</Text>
            <View style={styles.controls}>
              <Button label="걷기 시작" onPress={onStart} disabled={busy} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function gpsColor(accuracy: number): string {
  if (accuracy <= 10) return colors.success;
  if (accuracy <= 25) return colors.warning;
  return colors.danger;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  status: {
    alignSelf: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  statusActive: { color: colors.success },
  controls: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  idleTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  idleBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  gpsBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  gpsText: { fontSize: 12, fontWeight: '600', color: colors.text },
});
