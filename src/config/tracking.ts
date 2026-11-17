/**
 * 위치 추적·필터링 관련 튜닝 값.
 * 필드 테스트 결과에 따라 조정한다. (docs/walking-tracker-analysis.md 5.4, 5.8 참고)
 */
export const TRACKING_CONFIG = {
  filter: {
    /** 수평 정확도가 이 값(m)보다 나쁘면 버린다 */
    maxAccuracyM: 25,
    /** 직전 점 대비 속도가 이 값(m/s, ≈25km/h)을 넘으면 튐으로 간주 */
    maxWalkSpeedMs: 7,
    /** 직전 점과의 거리가 max(minMoveM, accuracy * minMoveAccuracyFactor) 미만이면 드리프트로 간주 */
    minMoveM: 2,
    minMoveAccuracyFactor: 0.5,
  },
  autoPause: {
    enabled: true,
    /** 마지막 유효 이동 이후 이 시간(ms) 동안 새 위치가 없으면 자동 일시정지로 본다 */
    gapMs: 30_000,
    /** 공백 구간의 평균 속도가 이보다 빠르면 (GPS 끊김 중 이동) 정지로 보지 않는다 */
    minSpeedMs: 0.5,
  },
  location: {
    distanceIntervalM: 3,
    /** Android 전용: 최소 업데이트 간격 */
    timeIntervalMs: 2000,
  },
  metrics: {
    /** 현재 페이스 계산 구간 */
    currentPaceWindowMs: 60_000,
    /** 현재 페이스를 표시하기 위한 최소 거리 */
    currentPaceMinDistanceM: 20,
    /** 평균 페이스를 표시하기 위한 최소 거리 */
    averagePaceMinDistanceM: 50,
    /** 칼로리 계산용 기본 체중 (설정 화면 추가 전 임시값) */
    defaultWeightKg: 65,
  },
  /** 필터 튜닝용 원시 GPS 로그 저장 여부 (개발 빌드에서만) */
  recordRawPoints: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
} as const;

export type FilterConfig = typeof TRACKING_CONFIG.filter;
export type AutoPauseConfig = { enabled: boolean; gapMs: number; minSpeedMs: number };
