import { averagePaceSecPerKm, currentPaceSecPerKm, estimateCalories, walkingMet } from '../metrics';
import type { TrackPoint } from '../types';

const M_PER_DEG_LAT = 111_195;

function pt(northM: number, t: number, segment = 0, seq = 0): TrackPoint {
  return {
    sessionId: 's',
    seq,
    segment,
    latitude: 37.5 + northM / M_PER_DEG_LAT,
    longitude: 127,
    altitude: null,
    accuracy: 5,
    speed: null,
    timestamp: t,
  };
}

describe('averagePaceSecPerKm', () => {
  it('1km를 10분에 → 600초/km', () => {
    expect(averagePaceSecPerKm(600_000, 1000, 50)).toBeCloseTo(600);
  });

  it('최소 거리 미만이면 null', () => {
    expect(averagePaceSecPerKm(60_000, 30, 50)).toBeNull();
  });
});

describe('currentPaceSecPerKm', () => {
  it('최근 구간 기준으로 계산 (1.25m/s → 800초/km)', () => {
    const points = Array.from({ length: 13 }, (_, i) => pt(i * 6.25, i * 5000, 0, i));
    expect(currentPaceSecPerKm(points, 60_000, 20)).toBeCloseTo(800, -1);
  });

  it('윈도우 밖의 점은 제외', () => {
    // 처음엔 느리게, 최근 60초는 빠르게(2m/s → 500초/km)
    const slow = Array.from({ length: 10 }, (_, i) => pt(i * 2, i * 10_000));
    const startM = 18;
    const startT = 90_000;
    const fast = Array.from({ length: 7 }, (_, i) => pt(startM + (i + 1) * 20, startT + (i + 1) * 10_000));
    expect(currentPaceSecPerKm([...slow, ...fast], 60_000, 20)).toBeCloseTo(500, -1);
  });

  it('구간(segment)이 바뀌면 이전 구간은 무시', () => {
    const points = [pt(0, 0, 0), pt(100, 60_000, 0), pt(100, 70_000, 1), pt(105, 80_000, 1)];
    // 마지막 구간: 5m → 최소 거리 미만
    expect(currentPaceSecPerKm(points, 60_000, 20)).toBeNull();
  });

  it('점이 부족하면 null', () => {
    expect(currentPaceSecPerKm([pt(0, 0)], 60_000, 20)).toBeNull();
  });
});

describe('칼로리', () => {
  it('속도별 MET', () => {
    expect(walkingMet(2)).toBe(2.0);
    expect(walkingMet(4.5)).toBe(3.5);
    expect(walkingMet(5.0)).toBe(4.3);
    expect(walkingMet(7)).toBe(7.0);
  });

  it('65kg, 시속 5km 로 1시간 → 4.3 × 65 ≈ 280kcal', () => {
    expect(estimateCalories(5000, 3_600_000, 65)).toBeCloseTo(279.5);
  });

  it('이동 시간 0이면 0', () => {
    expect(estimateCalories(0, 0, 65)).toBe(0);
  });
});
