import { formatDuration, formatKm, formatPace } from '../format';

describe('formatKm', () => {
  it.each([
    [0, '0.00'],
    [999, '0.99'],
    [1234.5, '1.23'],
    [10_000, '10.00'],
    [-5, '0.00'],
  ])('%p m → %p', (m, expected) => expect(formatKm(m)).toBe(expected));
});

describe('formatDuration', () => {
  it.each([
    [0, '00:00'],
    [59_999, '00:59'],
    [61_000, '01:01'],
    [3_600_000, '1:00:00'],
    [3_726_000, '1:02:06'],
  ])('%p ms → %p', (ms, expected) => expect(formatDuration(ms)).toBe(expected));
});

describe('formatPace', () => {
  it.each([
    [null, `--'--"`],
    [0, `--'--"`],
    [Infinity, `--'--"`],
    [485, `8'05"`],
    [599.6, `10'00"`],
    [100 * 60, `--'--"`],
  ])('%p s/km → %p', (pace, expected) => expect(formatPace(pace)).toBe(expected));
});
