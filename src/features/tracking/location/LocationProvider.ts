/**
 * 위치 수집 라이브러리 추상화.
 * expo-location 으로 시작하고, 백그라운드 안정성이 부족하면
 * react-native-background-geolocation 등으로 구현체만 교체한다.
 */
export interface LocationProvider {
  /** 포그라운드 위치 권한 확보. 거부되면 false */
  ensurePermission(): Promise<boolean>;
  /** 화면이 꺼져도 계속되는 위치 업데이트 시작 (앱이 포그라운드일 때 호출해야 함) */
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
}
