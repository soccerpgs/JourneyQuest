import type { TrackPoint } from '@/features/tracking/types';
import { endpointsFeature, routeFeature, segmentsFromPoints } from '../routeGeoJson';

function pt(lat: number, lng: number, segment: number): TrackPoint {
  return {
    sessionId: 's',
    seq: 0,
    segment,
    latitude: lat,
    longitude: lng,
    altitude: null,
    accuracy: 5,
    speed: null,
    timestamp: 0,
  };
}

describe('routeGeoJson', () => {
  const points = [pt(37.1, 127.1, 0), pt(37.2, 127.2, 0), pt(37.3, 127.3, 2), pt(37.4, 127.4, 2), pt(37.5, 127.5, 3)];

  it('구간별로 나누고 [lng, lat] 순서로 변환', () => {
    expect(segmentsFromPoints(points)).toEqual([
      { id: 0, coords: [[127.1, 37.1], [127.2, 37.2]] },
      { id: 2, coords: [[127.3, 37.3], [127.4, 37.4]] },
      { id: 3, coords: [[127.5, 37.5]] },
    ]);
  });

  it('점이 1개뿐인 구간은 선에서 제외', () => {
    const f = routeFeature(segmentsFromPoints(points));
    expect(f?.geometry.coordinates).toHaveLength(2);
  });

  it('그릴 선이 없으면 null', () => {
    expect(routeFeature(segmentsFromPoints([pt(37, 127, 0)]))).toBeNull();
    expect(routeFeature([])).toBeNull();
  });

  it('시작/종료 마커', () => {
    expect(endpointsFeature(points).features.map((f) => f.properties.kind)).toEqual(['start', 'end']);
    expect(endpointsFeature([points[0]]).features).toHaveLength(1);
    expect(endpointsFeature([]).features).toHaveLength(0);
  });
});
