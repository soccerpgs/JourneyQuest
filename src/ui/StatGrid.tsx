import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from './theme';

export interface StatItem {
  label: string;
  value: string;
  unit?: string;
}

/** 큰 대표 수치 + 보조 수치 격자 */
export function StatGrid({ hero, items }: { hero?: StatItem; items: StatItem[] }) {
  return (
    <View>
      {hero && (
        <View style={styles.hero}>
          <Text style={styles.heroValue} accessibilityLabel={`${hero.label} ${hero.value} ${hero.unit ?? ''}`}>
            {hero.value}
            {hero.unit ? <Text style={styles.heroUnit}> {hero.unit}</Text> : null}
          </Text>
          <Text style={styles.label}>{hero.label}</Text>
        </View>
      )}
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.label} style={styles.cell}>
            <Text style={styles.value} numberOfLines={1}>
              {item.value}
              {item.unit ? <Text style={styles.unit}> {item.unit}</Text> : null}
            </Text>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.md },
  heroValue: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: { fontSize: 20, fontWeight: '600', color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.33%', alignItems: 'center', paddingVertical: spacing.sm },
  value: { fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  label: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
