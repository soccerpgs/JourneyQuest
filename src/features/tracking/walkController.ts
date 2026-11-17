import { PermissionsAndroid, Platform } from 'react-native';
import { TRACKING_CONFIG } from '@/config/tracking';
import { pointsRepo } from '@/db/pointsRepo';
import { sessionsRepo } from '@/db/sessionsRepo';
import { pedometer } from '@/features/pedometer/pedometer';
import { createId } from '@/lib/id';
import { expoLocationProvider } from './location/expoLocationProvider';
import type { LocationProvider } from './location/LocationProvider';
import { estimateCalories } from './metrics';
import { runExclusive } from './pipeline';
import { finishSession, movingTimeMs, pauseSession, resumeSession } from './sessionMath';
import { useTrackingStore } from './trackingStore';
import type { Session } from './types';

const location: LocationProvider = expoLocationProvider;
const autoPauseCfg = TRACKING_CONFIG.autoPause;

export type StartResult = 'started' | 'permission-denied';

function onStepDelta(delta: number) {
  const { session, addSteps } = useTrackingStore.getState();
  if (session?.status === 'tracking') addSteps(delta);
}

/** Android 13+ 포그라운드 서비스 알림이 보이도록 알림 권한 요청 (거부해도 추적은 동작) */
async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    } catch {
      // 무시
    }
  }
}

async function save(session: Session) {
  await sessionsRepo.update(session);
  useTrackingStore.getState().setSession(session);
}

export async function startWalk(): Promise<StartResult> {
  if (!(await location.ensurePermission())) return 'permission-denied';
  await requestNotificationPermission();

  return runExclusive(async () => {
    const existing = await sessionsRepo.getActive();
    if (existing) {
      // 이미 진행 중인 세션이 있으면 새로 만들지 않고 이어서 진행
      await hydrateFromDb(existing);
      await location.start();
      void pedometer.start(onStepDelta);
      return 'started' as const;
    }

    const now = Date.now();
    const session: Session = {
      id: createId(),
      status: 'tracking',
      startedAt: now,
      endedAt: null,
      distanceM: 0,
      manualPausedMs: 0,
      autoPausedMs: 0,
      pausedAt: null,
      lastActivityAt: now,
      currentSegment: 0,
      steps: null,
      calories: null,
    };
    await sessionsRepo.insert(session);
    useTrackingStore.getState().hydrate(session, []);

    try {
      await location.start();
    } catch (e) {
      await sessionsRepo.delete(session.id);
      useTrackingStore.getState().reset();
      throw e;
    }
    void pedometer.start(onStepDelta);
    return 'started' as const;
  });
}

export function pauseWalk(): Promise<void> {
  return runExclusive(async () => {
    const s = useTrackingStore.getState().session;
    if (!s || s.status !== 'tracking') return;
    // 위치 서비스는 끄지 않는다: Android 는 백그라운드에서 포그라운드 서비스를 다시 시작할 수 없기 때문.
    // 일시정지 중 들어오는 점은 pipeline 에서 무시된다.
    await save({ ...pauseSession(s, Date.now(), autoPauseCfg), steps: useTrackingStore.getState().liveSteps });
  });
}

export function resumeWalk(): Promise<void> {
  return runExclusive(async () => {
    const s = useTrackingStore.getState().session;
    if (!s || s.status !== 'paused') return;
    await save(resumeSession(s, Date.now()));
    await location.start(); // 꺼져 있으면 다시 켠다 (사용자 조작이므로 포그라운드)
    void pedometer.start(onStepDelta);
  });
}

/** 걷기를 종료하고 저장한다. 저장된 세션 ID 반환 */
export function finishWalk(): Promise<string | null> {
  return runExclusive(async () => {
    const s = useTrackingStore.getState().session ?? (await sessionsRepo.getActive());
    if (!s) return null;
    const now = Date.now();
    await location.stop();
    pedometer.stop();

    let finished = finishSession(s, now, autoPauseCfg);
    const liveSteps = useTrackingStore.getState().liveSteps;
    const osSteps = await pedometer.getStepsBetween(finished.startedAt, now);
    const steps = Math.max(liveSteps, finished.steps ?? 0, osSteps ?? 0);
    const moving = movingTimeMs(finished, now, autoPauseCfg);
    finished = {
      ...finished,
      steps: steps > 0 ? steps : null,
      calories: estimateCalories(finished.distanceM, moving, TRACKING_CONFIG.metrics.defaultWeightKg),
    };
    await sessionsRepo.update(finished);
    useTrackingStore.getState().reset();
    return finished.id;
  });
}

/** 진행 중인 걷기를 저장하지 않고 버린다 */
export function discardWalk(): Promise<void> {
  return runExclusive(async () => {
    const s = useTrackingStore.getState().session ?? (await sessionsRepo.getActive());
    await location.stop();
    pedometer.stop();
    if (s) await sessionsRepo.delete(s.id);
    useTrackingStore.getState().reset();
  });
}

async function hydrateFromDb(session: Session) {
  const points = await pointsRepo.listBySession(session.id);
  useTrackingStore.getState().hydrate(session, points);
}

export type RestoreResult =
  /** 진행 중인 세션 없음 */
  | { kind: 'none' }
  /** 위치 추적이 살아 있어 그대로 이어감 (예: 개발 중 JS 리로드) */
  | { kind: 'resumed'; session: Session }
  /** 앱이 종료되었다가 다시 켜짐 → 사용자에게 이어서 할지 물어봐야 함 */
  | { kind: 'interrupted'; session: Session };

/** 앱 시작 시 호출: DB에 남은 진행 중 세션을 복구한다 */
export function restoreActiveWalk(): Promise<RestoreResult> {
  return runExclusive(async () => {
    const active = await sessionsRepo.getActive();
    const running = await location.isRunning();
    if (!active) {
      if (running) await location.stop(); // 주인 없는 위치 추적 정리
      return { kind: 'none' as const };
    }
    await hydrateFromDb(active);
    if (running) {
      void pedometer.start(onStepDelta);
      return { kind: 'resumed' as const, session: active };
    }
    return { kind: 'interrupted' as const, session: active };
  });
}

/** 중단된 세션을 이어서 기록 (앱이 꺼져 있던 시간은 일시정지로 처리) */
export function continueInterruptedWalk(): Promise<void> {
  return runExclusive(async () => {
    const s = useTrackingStore.getState().session;
    if (!s) return;
    const now = Date.now();
    const paused = s.status === 'tracking' ? pauseSession(s, s.lastActivityAt, autoPauseCfg) : s;
    await save(resumeSession(paused, now));
    await location.start();
    void pedometer.start(onStepDelta);
  });
}

/** 앱이 포그라운드로 돌아왔을 때 걸음 수 구독 재개 */
export function onAppForeground(): void {
  const s = useTrackingStore.getState().session;
  if (s && s.status !== 'finished') void pedometer.start(onStepDelta);
}
