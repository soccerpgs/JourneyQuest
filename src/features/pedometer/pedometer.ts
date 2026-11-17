import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';

type Subscription = { remove(): void };

let subscription: Subscription | null = null;
let lastSeen = 0;

/**
 * 걸음 수 센서 래퍼.
 * - watchStepCount 는 앱이 포그라운드일 때만 갱신된다.
 * - iOS 는 종료 시 getStepCountAsync(start, end) 로 백그라운드 구간까지 보정한다.
 * - Android 는 백그라운드 구간의 걸음 수를 얻을 수 없다 (Health Connect 연동 시 개선 가능).
 */
export const pedometer = {
  async ensurePermission(): Promise<boolean> {
    try {
      if (!(await Pedometer.isAvailableAsync())) return false;
      const current = await Pedometer.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) return false;
      return (await Pedometer.requestPermissionsAsync()).granted;
    } catch {
      return false;
    }
  },

  /** onDelta 는 직전 콜백 이후 증가한 걸음 수로 호출된다 */
  async start(onDelta: (delta: number) => void): Promise<void> {
    if (subscription) return;
    if (!(await this.ensurePermission())) return;
    lastSeen = 0;
    subscription = Pedometer.watchStepCount(({ steps }) => {
      // 구독 이후 누적값이 들어온다. 값이 줄면(센서 리셋) 기준을 다시 잡는다.
      const delta = steps >= lastSeen ? steps - lastSeen : steps;
      lastSeen = steps;
      if (delta > 0) onDelta(delta);
    });
  },

  stop(): void {
    subscription?.remove();
    subscription = null;
    lastSeen = 0;
  },

  /** iOS 전용: 기간 내 OS 기록 걸음 수. 다른 플랫폼이나 실패 시 null */
  async getStepsBetween(start: number, end: number): Promise<number | null> {
    if (Platform.OS !== 'ios') return null;
    try {
      const res = await Pedometer.getStepCountAsync(new Date(start), new Date(end));
      return res.steps;
    } catch {
      return null;
    }
  },
};
