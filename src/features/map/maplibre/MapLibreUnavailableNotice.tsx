import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/ui/theme';

/** 설치된 앱에 MapLibre 네이티브 모듈이 없을 때 지도 대신 표시 */
export function MapLibreUnavailableNotice() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>이 빌드에는 MapLibre가 없습니다</Text>
      <Text style={styles.body}>
        지도 라이브러리가 바뀌었으므로 개발 빌드를 다시 만들어 설치해야 합니다.{'\n'}
        npx eas-cli@latest build --profile development{'\n'}
        위치 기록과 통계는 지도 없이도 동작합니다.
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
