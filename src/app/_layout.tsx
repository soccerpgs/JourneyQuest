// ⚠️ 백그라운드 위치 태스크는 앱 진입 시 모듈 최상위에서 정의되어야 한다.
import '@/features/tracking/location/locationTask';

import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text } from 'react-native';
import { colors } from '@/ui/theme';

function HistoryButton() {
  return (
    <Link href="/history" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel="걷기 기록 보기" hitSlop={8}>
        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>기록</Text>
      </Pressable>
    </Link>
  );
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTransparent: false,
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'JourneyQuest', headerRight: () => <HistoryButton /> }} />
        <Stack.Screen name="history/index" options={{ title: '걷기 기록' }} />
        <Stack.Screen name="history/[id]" options={{ title: '기록 상세' }} />
      </Stack>
    </>
  );
}
