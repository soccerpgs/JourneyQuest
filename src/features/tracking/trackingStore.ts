import { create } from 'zustand';
import type { LngLat } from '@/lib/geo';
import type { RawLocation, Session, TrackPoint } from './types';

export interface RouteSegment {
  id: number;
  coords: LngLat[];
}

/** 현재 페이스 계산용으로 메모리에 유지하는 최근 점 개수 */
const RECENT_POINTS_LIMIT = 120;

interface TrackingState {
  /** 진행 중인 세션 (없으면 idle) */
  session: Session | null;
  /** 지도 렌더링용 경로 (구간별) */
  segments: RouteSegment[];
  recentPoints: TrackPoint[];
  /** 이번 세션에서 센서로 센 걸음 수 */
  liveSteps: number;
  /** 가장 최근 원시 위치 (필터 통과 여부 무관, GPS 상태 표시용) */
  lastFix: RawLocation | null;

  hydrate(session: Session, points: TrackPoint[]): void;
  setSession(session: Session): void;
  onPointsAccepted(session: Session, points: TrackPoint[]): void;
  setLastFix(fix: RawLocation): void;
  addSteps(delta: number): void;
  reset(): void;
}

function appendToSegments(segments: RouteSegment[], points: TrackPoint[]): RouteSegment[] {
  if (points.length === 0) return segments;
  const next = segments.slice();
  for (const p of points) {
    const lastSeg = next[next.length - 1];
    const coord: LngLat = [p.longitude, p.latitude];
    if (lastSeg && lastSeg.id === p.segment) {
      next[next.length - 1] = { id: lastSeg.id, coords: [...lastSeg.coords, coord] };
    } else {
      next.push({ id: p.segment, coords: [coord] });
    }
  }
  return next;
}

export const useTrackingStore = create<TrackingState>()((set, get) => ({
  session: null,
  segments: [],
  recentPoints: [],
  liveSteps: 0,
  lastFix: null,

  hydrate: (session, points) =>
    set({
      session,
      segments: appendToSegments([], points),
      recentPoints: points.slice(-RECENT_POINTS_LIMIT),
      liveSteps: session.steps ?? 0,
    }),

  setSession: (session) => set({ session }),

  onPointsAccepted: (session, points) => {
    // 다른 세션의 늦게 도착한 콜백은 무시
    if (get().session?.id !== session.id) return;
    set((s) => ({
      session,
      segments: appendToSegments(s.segments, points),
      recentPoints: points.length
        ? [...s.recentPoints, ...points].slice(-RECENT_POINTS_LIMIT)
        : s.recentPoints,
    }));
  },

  setLastFix: (fix) => set({ lastFix: fix }),

  addSteps: (delta) => {
    if (delta > 0) set((s) => ({ liveSteps: s.liveSteps + delta }));
  },

  reset: () => set({ session: null, segments: [], recentPoints: [], liveSteps: 0, lastFix: null }),
}));
