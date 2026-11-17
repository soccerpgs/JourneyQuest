import { TRACKING_CONFIG } from '@/config/tracking';
import { evaluatePoint } from '../filters';
import type { RawLocation } from '../types';

const cfg = TRACKING_CONFIG.filter;
/** 위도 1도 ≈ 111,195m */
const M_PER_DEG_LAT = 111_195;

function loc(northM: number, t: number, accuracy: number | null = 5): RawLocation {
  return {
    latitude: 37.5 + northM / M_PER_DEG_LAT,
    longitude: 127,
    altitude: null,
    accuracy,
    speed: null,
    heading: null,
    timestamp: t,
  };
}

describe('evaluatePoint', () => {
  it('첫 점은 정확도만 맞으면 채택, 거리 0', () => {
    expect(evaluatePoint(null, loc(0, 0), cfg)).toEqual({ accepted: true, distanceM: 0 });
  });

  it('정확도가 나쁘면 버림', () => {
    expect(evaluatePoint(null, loc(0, 0, 40), cfg)).toEqual({ accepted: false, reason: 'accuracy' });
  });

  it('정확도 정보가 없으면 정확도 검사는 통과', () => {
    expect(evaluatePoint(null, loc(0, 0, null), cfg).accepted).toBe(true);
  });

  it('시간이 같거나 역행하면 버림', () => {
    expect(evaluatePoint(loc(0, 1000), loc(5, 1000), cfg)).toEqual({ accepted: false, reason: 'stale' });
    expect(evaluatePoint(loc(0, 1000), loc(5, 500), cfg)).toEqual({ accepted: false, reason: 'stale' });
  });

  it('걷기 속도(1.4m/s)는 채택하고 거리를 반환', () => {
    const r = evaluatePoint(loc(0, 0), loc(7, 5000), cfg);
    expect(r.accepted).toBe(true);
    if (r.accepted) expect(r.distanceM).toBeCloseTo(7, 0);
  });

  it('비정상 속도(GPS 튐)는 버림', () => {
    // 2초에 50m = 25m/s
    expect(evaluatePoint(loc(0, 0), loc(50, 2000), cfg)).toEqual({ accepted: false, reason: 'speed' });
  });

  it('최소 이동 거리 미만은 드리프트로 보고 버림', () => {
    expect(evaluatePoint(loc(0, 0), loc(1, 3000), cfg)).toEqual({ accepted: false, reason: 'jitter' });
  });

  it('정확도가 나쁠수록 최소 이동 거리가 커짐', () => {
    // 정확도 20m → 최소 10m. 6m 이동은 드리프트
    expect(evaluatePoint(loc(0, 0), loc(6, 5000, 20), cfg)).toEqual({ accepted: false, reason: 'jitter' });
    // 정확도 5m → 최소 2.5m. 6m 이동은 채택
    expect(evaluatePoint(loc(0, 0), loc(6, 5000, 5), cfg).accepted).toBe(true);
  });
});
