import {
  autoPauseForGap,
  finishSession,
  isAutoPaused,
  movingTimeMs,
  pauseSession,
  resumeSession,
} from '../sessionMath';
import type { Session } from '../types';

const cfg = { enabled: true, gapMs: 30_000, minSpeedMs: 0.5 };
const off = { ...cfg, enabled: false };
const MIN = 60_000;

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    status: 'tracking',
    startedAt: 0,
    endedAt: null,
    distanceM: 0,
    manualPausedMs: 0,
    autoPausedMs: 0,
    pausedAt: null,
    lastActivityAt: 0,
    currentSegment: 0,
    steps: null,
    calories: null,
    ...overrides,
  };
}

describe('movingTimeMs', () => {
  it('계속 움직이면 경과 시간과 같음', () => {
    const s = session({ lastActivityAt: 10 * MIN - 5000 });
    expect(movingTimeMs(s, 10 * MIN, cfg)).toBe(10 * MIN);
  });

  it('수동 일시정지 중인 시간은 제외', () => {
    const s = session({ status: 'paused', pausedAt: 4 * MIN, lastActivityAt: 4 * MIN });
    expect(movingTimeMs(s, 10 * MIN, cfg)).toBe(4 * MIN);
  });

  it('누적 일시정지 시간 제외', () => {
    const s = session({ manualPausedMs: 2 * MIN, autoPausedMs: MIN, lastActivityAt: 10 * MIN });
    expect(movingTimeMs(s, 10 * MIN, cfg)).toBe(7 * MIN);
  });

  it('마지막 활동 이후 gap 이상 지나면 그 공백 전체를 자동 일시정지로 제외', () => {
    const s = session({ lastActivityAt: 5 * MIN });
    expect(isAutoPaused(s, 5 * MIN + 20_000, cfg)).toBe(false);
    expect(movingTimeMs(s, 5 * MIN + 20_000, cfg)).toBe(5 * MIN + 20_000);
    expect(isAutoPaused(s, 7 * MIN, cfg)).toBe(true);
    expect(movingTimeMs(s, 7 * MIN, cfg)).toBe(5 * MIN);
  });

  it('자동 일시정지 비활성화 시 공백도 이동 시간', () => {
    const s = session({ lastActivityAt: 5 * MIN });
    expect(movingTimeMs(s, 7 * MIN, off)).toBe(7 * MIN);
  });

  it('종료된 세션은 endedAt 기준', () => {
    const s = session({ status: 'finished', endedAt: 30 * MIN, manualPausedMs: 5 * MIN });
    expect(movingTimeMs(s, 99 * MIN, cfg)).toBe(25 * MIN);
  });
});

describe('autoPauseForGap', () => {
  it('짧은 간격은 정지 아님', () => {
    expect(autoPauseForGap(0, 10_000, 0, cfg)).toBe(0);
  });

  it('긴 간격 + 거의 이동 없음 → 공백 전체가 정지', () => {
    expect(autoPauseForGap(0, 2 * MIN, 5, cfg)).toBe(2 * MIN);
  });

  it('긴 간격이라도 그 사이 걷는 속도로 이동했으면 (GPS 끊김) 정지 아님', () => {
    // 2분에 150m = 1.25m/s
    expect(autoPauseForGap(0, 2 * MIN, 150, cfg)).toBe(0);
  });

  it('비활성화 시 항상 0', () => {
    expect(autoPauseForGap(0, 10 * MIN, 0, off)).toBe(0);
  });
});

describe('세션 상태 전이', () => {
  it('일시정지 → 재개 시 일시정지 시간이 누적되고 구간이 바뀜', () => {
    const s0 = session({ lastActivityAt: 5 * MIN - 1000 });
    const paused = pauseSession(s0, 5 * MIN, cfg);
    expect(paused).toMatchObject({ status: 'paused', pausedAt: 5 * MIN, autoPausedMs: 0 });

    const resumed = resumeSession(paused, 8 * MIN);
    expect(resumed).toMatchObject({
      status: 'tracking',
      pausedAt: null,
      manualPausedMs: 3 * MIN,
      lastActivityAt: 8 * MIN,
      currentSegment: 1,
    });
    // 재개 20초 후: 5분(일시정지 전) + 20초
    expect(movingTimeMs(resumed, 8 * MIN + 20_000, cfg)).toBe(5 * MIN + 20_000);
    // 재개 후 2분간 새 위치가 없으면 그 공백은 자동 일시정지로 제외
    expect(movingTimeMs(resumed, 10 * MIN, cfg)).toBe(5 * MIN);
  });

  it('자동 일시정지 상태에서 수동 일시정지하면 미확정 공백을 확정', () => {
    const s0 = session({ lastActivityAt: 2 * MIN });
    const paused = pauseSession(s0, 5 * MIN, cfg);
    expect(paused.autoPausedMs).toBe(3 * MIN);
    expect(movingTimeMs(paused, 9 * MIN, cfg)).toBe(2 * MIN);
  });

  it('일시정지 중 종료하면 일시정지 시간까지 확정', () => {
    const paused = session({ status: 'paused', pausedAt: 10 * MIN, lastActivityAt: 10 * MIN });
    const done = finishSession(paused, 15 * MIN, cfg);
    expect(done).toMatchObject({ status: 'finished', endedAt: 15 * MIN, manualPausedMs: 5 * MIN, pausedAt: null });
    expect(movingTimeMs(done, 99 * MIN, cfg)).toBe(10 * MIN);
  });

  it('상태가 맞지 않는 전이는 무시', () => {
    const s = session();
    expect(resumeSession(s, MIN)).toBe(s);
    const p = session({ status: 'paused', pausedAt: 0 });
    expect(pauseSession(p, MIN, cfg)).toBe(p);
  });
});
