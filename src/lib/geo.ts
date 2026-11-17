export interface LatLng {
  latitude: number;
  longitude: number;
}

/** GeoJSON/Mapbox 좌표: [경도, 위도] 순서에 주의 */
export type LngLat = [number, number];

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 두 좌표 사이의 대원 거리 (m) */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function toLngLat(p: LatLng): LngLat {
  return [p.longitude, p.latitude];
}

/** 좌표 목록의 경계 상자. 비어 있으면 null */
export function boundsOf(points: readonly LatLng[]): { ne: LngLat; sw: LngLat } | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
}
