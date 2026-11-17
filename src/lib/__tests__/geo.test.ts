import { boundsOf, haversine } from '../geo';

describe('haversine', () => {
  it('같은 점은 0m', () => {
    expect(haversine({ latitude: 37.5, longitude: 127 }, { latitude: 37.5, longitude: 127 })).toBe(0);
  });

  it('위도 0.001도 ≈ 111m', () => {
    const d = haversine({ latitude: 37.5, longitude: 127 }, { latitude: 37.501, longitude: 127 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it('서울시청 → 광화문 ≈ 1.1km', () => {
    const cityHall = { latitude: 37.5663, longitude: 126.9779 };
    const gwanghwamun = { latitude: 37.5759, longitude: 126.9769 };
    const d = haversine(cityHall, gwanghwamun);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1150);
  });
});

describe('boundsOf', () => {
  it('비어 있으면 null', () => {
    expect(boundsOf([])).toBeNull();
  });

  it('[lng, lat] 순서로 ne/sw 반환', () => {
    const b = boundsOf([
      { latitude: 37.5, longitude: 127.0 },
      { latitude: 37.6, longitude: 126.9 },
    ]);
    expect(b).toEqual({ ne: [127.0, 37.6], sw: [126.9, 37.5] });
  });
});
