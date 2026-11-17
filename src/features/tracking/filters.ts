import type { FilterConfig } from '@/config/tracking';
import { haversine } from '@/lib/geo';
import type { RawLocation } from './types';

export type RejectReason = 'accuracy' | 'stale' | 'speed' | 'jitter';

export type FilterResult =
  | { accepted: true; distanceM: number }
  | { accepted: false; reason: RejectReason };

/**
 * GPS 노이즈 필터. prev 는 같은 구간(segment)에서 마지막으로 채택된 점 (없으면 null).
 * 1) 정확도 → 2) 시간 역행 → 3) 비정상 속도 → 4) 최소 이동(드리프트) 순서로 검사한다.
 */
export function evaluatePoint(
  prev: RawLocation | null,
  cur: RawLocation,
  cfg: FilterConfig,
): FilterResult {
  if (cur.accuracy != null && cur.accuracy > cfg.maxAccuracyM) {
    return { accepted: false, reason: 'accuracy' };
  }
  if (!prev) return { accepted: true, distanceM: 0 };

  const dtSec = (cur.timestamp - prev.timestamp) / 1000;
  if (dtSec <= 0) return { accepted: false, reason: 'stale' };

  const d = haversine(prev, cur);
  if (d / dtSec > cfg.maxWalkSpeedMs) return { accepted: false, reason: 'speed' };

  const minMove = Math.max(cfg.minMoveM, (cur.accuracy ?? 0) * cfg.minMoveAccuracyFactor);
  if (d < minMove) return { accepted: false, reason: 'jitter' };

  return { accepted: true, distanceM: d };
}
