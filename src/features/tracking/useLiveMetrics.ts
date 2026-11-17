import { TRACKING_CONFIG } from '@/config/tracking';
import { useNow } from '@/ui/useNow';
import { averagePaceSecPerKm, currentPaceSecPerKm, estimateCalories } from './metrics';
import { isAutoPaused, movingTimeMs } from './sessionMath';
import { useTrackingStore } from './trackingStore';

const { autoPause, metrics } = TRACKING_CONFIG;

/** 진행 중인 세션의 실시간 지표 (1초마다 갱신) */
export function useLiveMetrics() {
  const session = useTrackingStore((s) => s.session);
  const recentPoints = useTrackingStore((s) => s.recentPoints);
  const liveSteps = useTrackingStore((s) => s.liveSteps);
  const now = useNow(session ? 1000 : null);

  if (!session) return null;

  const movingMs = movingTimeMs(session, now, autoPause);
  const autoPaused = isAutoPaused(session, now, autoPause);
  return {
    status: session.status,
    autoPaused,
    distanceM: session.distanceM,
    movingMs,
    averagePace: averagePaceSecPerKm(movingMs, session.distanceM, metrics.averagePaceMinDistanceM),
    currentPace:
      session.status === 'tracking' && !autoPaused
        ? currentPaceSecPerKm(recentPoints, metrics.currentPaceWindowMs, metrics.currentPaceMinDistanceM)
        : null,
    steps: liveSteps,
    calories: estimateCalories(session.distanceM, movingMs, metrics.defaultWeightKg),
  };
}
