import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { TRACKING_CONFIG } from '@/config/tracking';
import { sessionsRepo } from '@/db/sessionsRepo';
import { averagePaceSecPerKm } from '@/features/tracking/metrics';
import { movingTimeMs } from '@/features/tracking/sessionMath';
import type { Session } from '@/features/tracking/types';
import { formatDateTime, formatDuration, formatKm, formatPace } from '@/lib/format';
import { colors, radius, spacing } from '@/ui/theme';

export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      sessionsRepo.listFinished().then((list) => {
        if (active) setSessions(list);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const totalM = sessions?.reduce((sum, s) => sum + s.distanceM, 0) ?? 0;

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.list}
      data={sessions ?? []}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={
        sessions && sessions.length > 0 ? (
          <Text style={styles.summary}>
            총 {sessions.length}회 · {formatKm(totalM)} km
          </Text>
        ) : undefined
      }
      ListEmptyComponent={
        sessions ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>아직 걷기 기록이 없습니다.</Text>
          </View>
        ) : undefined
      }
      renderItem={({ item }) => {
        const moving = movingTimeMs(item, item.endedAt ?? item.startedAt, TRACKING_CONFIG.autoPause);
        const pace = averagePaceSecPerKm(
          moving,
          item.distanceM,
          TRACKING_CONFIG.metrics.averagePaceMinDistanceM,
        );
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/history/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.date}>{formatDateTime(item.startedAt)}</Text>
            <View style={styles.row}>
              <Text style={styles.distance}>
                {formatKm(item.distanceM)}
                <Text style={styles.unit}> km</Text>
              </Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{formatDuration(moving)}</Text>
                <Text style={styles.metaText}>{formatPace(pace)}/km</Text>
                {item.steps != null && <Text style={styles.metaText}>{item.steps.toLocaleString()}걸음</Text>}
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  summary: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  date: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  distance: { fontSize: 28, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  meta: { alignItems: 'flex-end', gap: 2 },
  metaText: { fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});
