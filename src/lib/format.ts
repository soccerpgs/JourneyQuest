const pad2 = (n: number) => String(n).padStart(2, '0');

/** 1234.5 → "1.23" (km, 소수 둘째 자리 버림) */
export function formatKm(meters: number): string {
  const km = Math.floor(Math.max(0, meters) / 10) / 100;
  return km.toFixed(2);
}

/** ms → "MM:SS" 또는 "H:MM:SS" */
export function formatDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** 초/km → 8'05" . null 이거나 비정상 값이면 "--'--\"" */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0 || secPerKm >= 100 * 60) {
    return `--'--"`;
  }
  const rounded = Math.round(secPerKm);
  return `${Math.floor(rounded / 60)}'${pad2(rounded % 60)}"`;
}

export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
