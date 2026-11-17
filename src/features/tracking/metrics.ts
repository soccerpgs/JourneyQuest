import { haversine } from '@/lib/geo';
import type { TrackPoint } from './types';

/** 평균 페이스 (초/km). 거리가 너무 짧으면 null */
export function averagePaceSecPerKm(
  movingMs: number,
  distanceM: number,
  minDistanceM: number,
): number | null {
  if (distanceM < minDistanceM || movingMs <= 0) return null;
  return movingMs / 1000 / (distanceM / 1000);
}

/**
 * 현재 페이스 (초/km): 마지막 구간(segment)의 최근 windowMs 동안의 이동 기준.
 * points 는 timestamp 오름차순이어야 한다.
 */
export function currentPaceSecPerKm(
  points: readonly TrackPoint[],
  windowMs: number,
  minDistanceM: number,
): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  let dist = 0;
  let first = last;
  for (let i = points.length - 2; i >= 0; i--) {
    const p = points[i];
    if (p.segment !== last.segment || last.timestamp - p.timestamp > windowMs) break;
    dist += haversine(p, points[i + 1]);
    first = p;
  }
  const sec = (last.timestamp - first.timestamp) / 1000;
  if (dist < minDistanceM || sec <= 0) return null;
  return sec / (dist / 1000);
}

/** 걷기 속도(km/h)별 MET (Compendium of Physical Activities 근사치) */
export function walkingMet(speedKmh: number): number {
  if (speedKmh < 3.2) return 2.0;
  if (speedKmh < 4.0) return 2.8;
  if (speedKmh < 4.8) return 3.5;
  if (speedKmh < 5.6) return 4.3;
  if (speedKmh < 6.4) return 5.0;
  return 7.0;
}

/** 칼로리(kcal) 추정 = MET × 체중(kg) × 시간(h) */
export function estimateCalories(distanceM: number, movingMs: number, weightKg: number): number {
  if (movingMs <= 0) return 0;
  const hours = movingMs / 3_600_000;
  const speedKmh = distanceM / 1000 / hours;
  return walkingMet(speedKmh) * weightKg * hours;
}
