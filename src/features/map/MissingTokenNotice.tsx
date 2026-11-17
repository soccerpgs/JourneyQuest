import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/ui/theme';

/** Mapbox 토큰이 없을 때 지도 대신 표시. 위치 기록 자체는 계속 동작한다. */
export function MissingTokenNotice() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>지도를 표시할 수 없습니다</Text>
      <Text style={styles.body}>
        프로젝트 루트의 .env.local 파일에 EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN(pk.…)을 설정한 뒤 앱을 다시
        빌드하세요.{'\n'}위치 기록과 통계는 지도 없이도 동작합니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  body: { fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
});
