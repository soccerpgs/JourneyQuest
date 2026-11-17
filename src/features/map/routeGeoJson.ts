import type { LngLat } from '@/lib/geo';
import type { RouteSegment } from '@/features/tracking/trackingStore';
import type { TrackPoint } from '@/features/tracking/types';

/** 구간별 좌표 → MultiLineString (점이 2개 미만인 구간은 제외). 그릴 선이 없으면 null */
export function routeFeature(
  segments: readonly RouteSegment[],
): GeoJSON.Feature<GeoJSON.MultiLineString> | null {
  const lines = segments.filter((s) => s.coords.length >= 2).map((s) => s.coords);
  if (lines.length === 0) return null;
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } };
}

/** 저장된 점 목록 → 구간 목록 */
export function segmentsFromPoints(points: readonly TrackPoint[]): RouteSegment[] {
  const result: RouteSegment[] = [];
  for (const p of points) {
    const coord: LngLat = [p.longitude, p.latitude];
    const last = result[result.length - 1];
    if (last && last.id === p.segment) last.coords.push(coord);
    else result.push({ id: p.segment, coords: [coord] });
  }
  return result;
}

/** 시작/종료 지점 마커용 FeatureCollection */
export function endpointsFeature(
  points: readonly TrackPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Point, { kind: 'start' | 'end' }> {
  const features: GeoJSON.Feature<GeoJSON.Point, { kind: 'start' | 'end' }>[] = [];
  const first = points[0];
  const last = points[points.length - 1];
  if (first) {
    features.push({
      type: 'Feature',
      properties: { kind: 'start' },
      geometry: { type: 'Point', coordinates: [first.longitude, first.latitude] },
    });
  }
  if (last && points.length > 1) {
    features.push({
      type: 'Feature',
      properties: { kind: 'end' },
      geometry: { type: 'Point', coordinates: [last.longitude, last.latitude] },
    });
  }
  return { type: 'FeatureCollection', features };
}
