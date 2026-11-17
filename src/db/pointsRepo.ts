import type { RejectReason } from '@/features/tracking/filters';
import type { RawLocation, TrackPoint } from '@/features/tracking/types';
import { getDb } from './client';

interface PointRow {
  session_id: string;
  seq: number;
  segment: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
}

const fromRow = (r: PointRow): TrackPoint => ({
  sessionId: r.session_id,
  seq: r.seq,
  segment: r.segment,
  latitude: r.latitude,
  longitude: r.longitude,
  altitude: r.altitude,
  accuracy: r.accuracy,
  speed: r.speed,
  timestamp: r.timestamp,
});

export interface RawLogEntry {
  location: RawLocation;
  accepted: boolean;
  reason: RejectReason | null;
}

export const pointsRepo = {
  /** 호출하는 쪽에서 트랜잭션으로 감싸는 것을 권장 */
  async insertMany(points: readonly TrackPoint[]): Promise<void> {
    if (points.length === 0) return;
    const stmt = await getDb().prepareAsync(
      `INSERT INTO track_points (session_id, seq, segment, latitude, longitude, altitude, accuracy, speed, timestamp)
       VALUES ($session_id, $seq, $segment, $latitude, $longitude, $altitude, $accuracy, $speed, $timestamp)`,
    );
    try {
      for (const p of points) {
        await stmt.executeAsync({
          $session_id: p.sessionId,
          $seq: p.seq,
          $segment: p.segment,
          $latitude: p.latitude,
          $longitude: p.longitude,
          $altitude: p.altitude,
          $accuracy: p.accuracy,
          $speed: p.speed,
          $timestamp: p.timestamp,
        });
      }
    } finally {
      await stmt.finalizeAsync();
    }
  },

  async insertRaw(sessionId: string, entries: readonly RawLogEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const stmt = await getDb().prepareAsync(
      `INSERT INTO raw_points (session_id, latitude, longitude, accuracy, speed, timestamp, accepted, reason)
       VALUES ($session_id, $latitude, $longitude, $accuracy, $speed, $timestamp, $accepted, $reason)`,
    );
    try {
      for (const e of entries) {
        await stmt.executeAsync({
          $session_id: sessionId,
          $latitude: e.location.latitude,
          $longitude: e.location.longitude,
          $accuracy: e.location.accuracy,
          $speed: e.location.speed,
          $timestamp: e.location.timestamp,
          $accepted: e.accepted ? 1 : 0,
          $reason: e.reason,
        });
      }
    } finally {
      await stmt.finalizeAsync();
    }
  },

  async listBySession(sessionId: string): Promise<TrackPoint[]> {
    const rows = await getDb().getAllAsync<PointRow>(
      'SELECT * FROM track_points WHERE session_id = ? ORDER BY seq ASC',
      sessionId,
    );
    return rows.map(fromRow);
  },

  async last(sessionId: string): Promise<TrackPoint | null> {
    const row = await getDb().getFirstAsync<PointRow>(
      'SELECT * FROM track_points WHERE session_id = ? ORDER BY seq DESC LIMIT 1',
      sessionId,
    );
    return row ? fromRow(row) : null;
  },
};
