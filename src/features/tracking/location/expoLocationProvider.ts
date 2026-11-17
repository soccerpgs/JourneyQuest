import * as Location from 'expo-location';
import { TRACKING_CONFIG } from '@/config/tracking';
import type { RawLocation } from '../types';
import type { LocationProvider } from './LocationProvider';

/** locationTask.ts 에서 같은 이름으로 defineTask 한다 */
export const LOCATION_TASK_NAME = 'journeyquest-walk-location';

export function toRawLocation(l: Location.LocationObject): RawLocation {
  return {
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
    altitude: l.coords.altitude,
    accuracy: l.coords.accuracy,
    speed: l.coords.speed,
    heading: l.coords.heading,
    timestamp: l.timestamp,
  };
}

/**
 * - Android: foregroundService 옵션을 주면 ACCESS_BACKGROUND_LOCATION 없이
 *   포그라운드 서비스(상단 알림)로 화면 꺼짐 중에도 추적된다.
 * - iOS: "앱 사용 중" 권한 + UIBackgroundModes(location) 으로
 *   포그라운드에서 시작한 추적이 백그라운드에서도 유지된다.
 * 따라서 "항상 허용" 권한은 요청하지 않는다.
 */
export const expoLocationProvider: LocationProvider = {
  async ensurePermission() {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const res = await Location.requestForegroundPermissionsAsync();
    return res.granted;
  },

  async start() {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) return;
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: TRACKING_CONFIG.location.distanceIntervalM,
      timeInterval: TRACKING_CONFIG.location.timeIntervalMs,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'JourneyQuest 걷기 기록 중',
        notificationBody: '이동 경로와 거리를 기록하고 있습니다.',
        notificationColor: '#4F46E5',
        killServiceOnDestroy: false,
      },
    });
  },

  async stop() {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  },

  isRunning: () => Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME),
};
