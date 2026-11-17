import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TRACKING_CONFIG } from '@/config/tracking';
import { pointsRepo } from '@/db/pointsRepo';
import { sessionsRepo } from '@/db/sessionsRepo';
import { RouteMap } from '@/features/map/RouteMap';
import { averagePaceSecPerKm } from '@/features/tracking/metrics';
import { movingTimeMs } from '@/features/tracking/sessionMath';
import type { Session, TrackPoint } from '@/features/tracking/types';
import { formatDateTime, formatDuration, formatKm, formatPace, formatTime } from '@/lib/format';
import { Button } from '@/ui/Button';
import { StatGrid } from '@/ui/StatGrid';
import { colors, radius, spacing } from '@/ui/theme';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ session: Session | null; points: TrackPoint[] } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [session, points] = await Promise.all([sessionsRepo.get(id), pointsRepo.listBySession(id)]);
      if (active) setData({ session, points });
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const { session, points } = data;
  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>기록을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  // 목록에는 종료된 세션만 노출되므로 endedAt 이 있어야 정상
  const end = session.endedAt ?? session.lastActivityAt;
  const moving = movingTimeMs(session, end, TRACKING_CONFIG.autoPause);
  const pace = averagePaceSecPerKm(moving, session.distanceM, TRACKING_CONFIG.metrics.averagePaceMinDistanceM);

  const onDelete = () =>
    Alert.alert('이 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await sessionsRepo.delete(session.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
    >
      <View style={styles.mapBox}>
        <RouteMap points={points} />
      </View>

      <View style={styles.card}>
        <Text style={styles.date}>
          {formatDateTime(session.startedAt)} – {formatTime(end)}
        </Text>
        <StatGrid
          hero={{ label: '거리', value: formatKm(session.distanceM), unit: 'km' }}
          items={[
            { label: '이동 시간', value: formatDuration(moving) },
            { label: '평균 페이스', value: formatPace(pace) },
            { label: '전체 경과', value: formatDuration(end - session.startedAt) },
            { label: '걸음', value: session.steps != null ? session.steps.toLocaleString() : '-' },
            {
              label: '칼로리(추정)',
              value: session.calories != null ? String(Math.round(session.calories)) : '-',
              unit: 'kcal',
            },
            { label: '기록 지점', value: points.length.toLocaleString() },
          ]}
        />
      </View>

      <View style={styles.actions}>
        <Button label="기록 삭제" variant="danger" onPress={onDelete} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted },
  mapBox: { height: 320, backgroundColor: colors.border },
  card: {
    backgroundColor: colors.surface,
    margin: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  date: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  actions: { flexDirection: 'row', paddingHorizontal: spacing.lg },
});
