import type { RouteSegment } from '@/features/tracking/trackingStore';
import type { TrackPoint } from '@/features/tracking/types';

/** 지도 제공자와 관계없이 공통인 지도 컴포넌트 props. 화면(src/app)은 이 타입만 안다. */
export interface WalkMapProps {
  segments: readonly RouteSegment[];
  /** 하단 패널에 가려지지 않도록 사용자 위치를 위로 올리는 여백 */
  bottomInset?: number;
  /** 위치 권한이 허용되었는지. true 가 되는 시점에 내 위치로 카메라를 옮긴다 */
  locationGranted: boolean;
}

export interface RouteMapProps {
  points: readonly TrackPoint[];
}

/** 위치를 모를 때의 초기 화면 (서울시청). 위도·경도 0(아프리카 앞바다)으로 시작하지 않도록 */
export const FALLBACK_CENTER: [number, number] = [126.978, 37.5665];
/** 내 위치를 따라갈 때의 줌 */
export const FOLLOW_ZOOM = 16;
