import type { Session, SessionStatus } from '@/features/tracking/types';
import { getDb } from './client';

interface SessionRow {
  id: string;
  status: SessionStatus;
  started_at: number;
  ended_at: number | null;
  distance_m: number;
  manual_paused_ms: number;
  auto_paused_ms: number;
  paused_at: number | null;
  last_activity_at: number;
  current_segment: number;
  steps: number | null;
  calories: number | null;
}

const fromRow = (r: SessionRow): Session => ({
  id: r.id,
  status: r.status,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  distanceM: r.distance_m,
  manualPausedMs: r.manual_paused_ms,
  autoPausedMs: r.auto_paused_ms,
  pausedAt: r.paused_at,
  lastActivityAt: r.last_activity_at,
  currentSegment: r.current_segment,
  steps: r.steps,
  calories: r.calories,
});

const params = (s: Session) => ({
  $id: s.id,
  $status: s.status,
  $started_at: s.startedAt,
  $ended_at: s.endedAt,
  $distance_m: s.distanceM,
  $manual_paused_ms: s.manualPausedMs,
  $auto_paused_ms: s.autoPausedMs,
  $paused_at: s.pausedAt,
  $last_activity_at: s.lastActivityAt,
  $current_segment: s.currentSegment,
  $steps: s.steps,
  $calories: s.calories,
});

export const sessionsRepo = {
  async insert(s: Session): Promise<void> {
    await getDb().runAsync(
      `INSERT INTO sessions (id, status, started_at, ended_at, distance_m, manual_paused_ms, auto_paused_ms,
         paused_at, last_activity_at, current_segment, steps, calories)
       VALUES ($id, $status, $started_at, $ended_at, $distance_m, $manual_paused_ms, $auto_paused_ms,
         $paused_at, $last_activity_at, $current_segment, $steps, $calories)`,
      params(s),
    );
  },

  async update(s: Session): Promise<void> {
    await getDb().runAsync(
      `UPDATE sessions SET status = $status, started_at = $started_at, ended_at = $ended_at,
         distance_m = $distance_m, manual_paused_ms = $manual_paused_ms, auto_paused_ms = $auto_paused_ms,
         paused_at = $paused_at, last_activity_at = $last_activity_at, current_segment = $current_segment,
         steps = $steps, calories = $calories
       WHERE id = $id`,
      params(s),
    );
  },

  async get(id: string): Promise<Session | null> {
    const row = await getDb().getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id = ?', id);
    return row ? fromRow(row) : null;
  },

  /** 진행 중(기록 중/일시정지)인 세션. 정상이라면 최대 1개 */
  async getActive(): Promise<Session | null> {
    const row = await getDb().getFirstAsync<SessionRow>(
      `SELECT * FROM sessions WHERE status IN ('tracking', 'paused') ORDER BY started_at DESC LIMIT 1`,
    );
    return row ? fromRow(row) : null;
  },

  async listFinished(): Promise<Session[]> {
    const rows = await getDb().getAllAsync<SessionRow>(
      `SELECT * FROM sessions WHERE status = 'finished' ORDER BY started_at DESC`,
    );
    return rows.map(fromRow);
  },

  async delete(id: string): Promise<void> {
    await getDb().runAsync('DELETE FROM sessions WHERE id = ?', id);
  },
};
