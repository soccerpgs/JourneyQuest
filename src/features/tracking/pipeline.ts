import { TRACKING_CONFIG } from '@/config/tracking';
import { getDb } from '@/db/client';
import { pointsRepo, type RawLogEntry } from '@/db/pointsRepo';
import { sessionsRepo } from '@/db/sessionsRepo';
import { evaluatePoint } from './filters';
import { autoPauseForGap } from './sessionMath';
import { useTrackingStore } from './trackingStore';
import type { RawLocation, Session, TrackPoint } from './types';

/** 시작/재개 직전의 캐시된 위치를 거르기 위한 허용 오차 */
const STALE_TOLERANCE_MS = 1000;

let queue: Promise<void> = Promise.resolve();

/**
 * 위치 배치를 직렬로 처리한다. 백그라운드 콜백이 겹쳐 들어와도
 * "마지막 점" 계산이 꼬이지 않도록 한 번에 하나씩만 실행한다.
 */
export function enqueueLocations(locations: RawLocation[]): Promise<void> {
  queue = queue
    .then(() => processBatch(locations))
    .catch((e) => console.warn('[pipeline] failed to process locations', e));
  return queue;
}

/** 세션 상태 변경(일시정지/종료 등)을 진행 중인 배치 처리 뒤로 줄 세운다 */
export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function processBatch(locations: RawLocation[]): Promise<void> {
  const sorted = [...locations].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted[sorted.length - 1];
  const store = useTrackingStore.getState();
  if (latest) store.setLastFix(latest);

  const session = await sessionsRepo.getActive();
  if (!session || session.status !== 'tracking') return;

  const lastStored = await pointsRepo.last(session.id);
  let prev: RawLocation | null =
    lastStored && lastStored.segment === session.currentSegment ? toRaw(lastStored) : null;
  let seq = (lastStored?.seq ?? -1) + 1;

  let next: Session = { ...session };
  const accepted: TrackPoint[] = [];
  const rawLog: RawLogEntry[] = [];

  for (const loc of sorted) {
    if (loc.timestamp < next.lastActivityAt - STALE_TOLERANCE_MS) {
      rawLog.push({ location: loc, accepted: false, reason: 'stale' });
      continue;
    }
    const result = evaluatePoint(prev, loc, TRACKING_CONFIG.filter);
    if (!result.accepted) {
      rawLog.push({ location: loc, accepted: false, reason: result.reason });
      continue;
    }
    rawLog.push({ location: loc, accepted: true, reason: null });

    const autoPaused = autoPauseForGap(
      next.lastActivityAt,
      loc.timestamp,
      result.distanceM,
      TRACKING_CONFIG.autoPause,
    );
    next = {
      ...next,
      distanceM: next.distanceM + result.distanceM,
      autoPausedMs: next.autoPausedMs + autoPaused,
      lastActivityAt: Math.max(next.lastActivityAt, loc.timestamp),
    };
    accepted.push({
      sessionId: next.id,
      seq: seq++,
      segment: next.currentSegment,
      latitude: loc.latitude,
      longitude: loc.longitude,
      altitude: loc.altitude,
      accuracy: loc.accuracy,
      speed: loc.speed,
      timestamp: loc.timestamp,
    });
    prev = loc;
  }

  // 포그라운드에서 센 걸음 수를 함께 저장 (앱이 강제 종료돼도 남도록)
  if (store.session?.id === next.id && store.liveSteps > (next.steps ?? 0)) {
    next = { ...next, steps: store.liveSteps };
  }

  await getDb().withTransactionAsync(async () => {
    await pointsRepo.insertMany(accepted);
    if (TRACKING_CONFIG.recordRawPoints) await pointsRepo.insertRaw(next.id, rawLog);
    if (accepted.length > 0 || next.steps !== session.steps) await sessionsRepo.update(next);
  });

  if (accepted.length > 0) useTrackingStore.getState().onPointsAccepted(next, accepted);
}

function toRaw(p: TrackPoint): RawLocation {
  return {
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: p.altitude,
    accuracy: p.accuracy,
    speed: p.speed,
    heading: null,
    timestamp: p.timestamp,
  };
}
