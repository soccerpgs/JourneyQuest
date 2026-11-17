import type { AutoPauseConfig } from '@/config/tracking';
import type { Session } from './types';

type TimeFields = Pick<
  Session,
  'status' | 'startedAt' | 'endedAt' | 'manualPausedMs' | 'autoPausedMs' | 'pausedAt' | 'lastActivityAt'
>;

/**
 * 아직 확정되지 않은 자동 일시정지 시간.
 * 기록 중인데 마지막 유효 이동 이후 gapMs 이상 새 점이 없으면, 그 공백 전체를 정지로 본다.
 */
export function pendingAutoPauseMs(s: TimeFields, now: number, cfg: AutoPauseConfig): number {
  if (!cfg.enabled || s.status !== 'tracking') return 0;
  const gap = now - s.lastActivityAt;
  return gap > cfg.gapMs ? gap : 0;
}

export function isAutoPaused(s: TimeFields, now: number, cfg: AutoPauseConfig): boolean {
  return pendingAutoPauseMs(s, now, cfg) > 0;
}

/** 실제 이동 시간 = 전체 경과 − 수동 일시정지 − 자동 일시정지 */
export function movingTimeMs(s: TimeFields, now: number, cfg: AutoPauseConfig): number {
  const end = s.endedAt ?? now;
  let paused = s.manualPausedMs + s.autoPausedMs;
  if (s.status === 'paused' && s.pausedAt != null) paused += end - s.pausedAt;
  paused += pendingAutoPauseMs(s, end, cfg);
  return Math.max(0, end - s.startedAt - paused);
}

/**
 * 새 유효 점이 도착했을 때, 직전 활동 이후의 공백을 자동 일시정지로 확정할지 판단.
 * 공백이 길어도 그 사이 평균 속도가 충분하면 (터널 등 GPS 끊김 중 이동) 이동으로 본다.
 * @returns 자동 일시정지 시간에 더할 ms
 */
export function autoPauseForGap(
  lastActivityAt: number,
  pointTimestamp: number,
  distanceM: number,
  cfg: AutoPauseConfig,
): number {
  if (!cfg.enabled) return 0;
  const gap = pointTimestamp - lastActivityAt;
  if (gap <= cfg.gapMs) return 0;
  const speed = distanceM / (gap / 1000);
  return speed < cfg.minSpeedMs ? gap : 0;
}

/** 일시정지 / 종료 직전에 미확정 자동 일시정지 시간을 확정한다 */
export function settleAutoPause<T extends TimeFields>(s: T, now: number, cfg: AutoPauseConfig): T {
  const pending = pendingAutoPauseMs(s, now, cfg);
  return pending > 0 ? { ...s, autoPausedMs: s.autoPausedMs + pending } : s;
}

export function pauseSession<T extends TimeFields>(s: T, now: number, cfg: AutoPauseConfig): T {
  if (s.status !== 'tracking') return s;
  return { ...settleAutoPause(s, now, cfg), status: 'paused', pausedAt: now };
}

export function resumeSession<T extends TimeFields & { currentSegment: number }>(s: T, now: number): T {
  if (s.status !== 'paused' || s.pausedAt == null) return s;
  return {
    ...s,
    status: 'tracking',
    manualPausedMs: s.manualPausedMs + (now - s.pausedAt),
    pausedAt: null,
    lastActivityAt: now,
    currentSegment: s.currentSegment + 1,
  };
}

export function finishSession<T extends TimeFields>(s: T, now: number, cfg: AutoPauseConfig): T {
  if (s.status === 'finished') return s;
  let next = settleAutoPause(s, now, cfg);
  if (next.status === 'paused' && next.pausedAt != null) {
    next = { ...next, manualPausedMs: next.manualPausedMs + (now - next.pausedAt) };
  }
  return { ...next, status: 'finished', pausedAt: null, endedAt: now };
}
