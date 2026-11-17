export type SessionStatus = 'tracking' | 'paused' | 'finished';

/** 위치 라이브러리에서 들어오는 원시 좌표 (라이브러리 독립적인 형태) */
export interface RawLocation {
  latitude: number;
  longitude: number;
  altitude: number | null;
  /** 수평 정확도 (m) */
  accuracy: number | null;
  /** m/s */
  speed: number | null;
  heading: number | null;
  /** epoch ms */
  timestamp: number;
}

/** 필터를 통과해 저장되는 경로 점 */
export interface TrackPoint {
  sessionId: string;
  seq: number;
  /** 일시정지 후 재개할 때마다 +1. 지도에서 선을 끊어 그리는 데 사용 */
  segment: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
}

export interface Session {
  id: string;
  status: SessionStatus;
  startedAt: number;
  endedAt: number | null;
  distanceM: number;
  /** 사용자가 직접 일시정지한 누적 시간 */
  manualPausedMs: number;
  /** 자동 일시정지로 판정된 누적 시간 */
  autoPausedMs: number;
  /** status === 'paused' 일 때 일시정지 시작 시각 */
  pausedAt: number | null;
  /** 마지막 유효 이동(또는 시작/재개) 시각. 자동 일시정지 판정 기준 */
  lastActivityAt: number;
  currentSegment: number;
  steps: number | null;
  calories: number | null;
}
