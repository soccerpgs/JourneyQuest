import * as SQLite from 'expo-sqlite';

const DB_NAME = 'journeyquest.db';

/** 버전별 마이그레이션. 인덱스 + 1 이 PRAGMA user_version 값이 된다. 기존 항목은 수정하지 말고 추가만 할 것. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS sessions (
    id                TEXT PRIMARY KEY NOT NULL,
    status            TEXT NOT NULL,
    started_at        INTEGER NOT NULL,
    ended_at          INTEGER,
    distance_m        REAL NOT NULL DEFAULT 0,
    manual_paused_ms  INTEGER NOT NULL DEFAULT 0,
    auto_paused_ms    INTEGER NOT NULL DEFAULT 0,
    paused_at         INTEGER,
    last_activity_at  INTEGER NOT NULL,
    current_segment   INTEGER NOT NULL DEFAULT 0,
    steps             INTEGER,
    calories          REAL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status, started_at);

  CREATE TABLE IF NOT EXISTS track_points (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,
    segment     INTEGER NOT NULL,
    latitude    REAL NOT NULL,
    longitude   REAL NOT NULL,
    altitude    REAL,
    accuracy    REAL,
    speed       REAL,
    timestamp   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_points_session ON track_points(session_id, seq);

  -- 필터 튜닝용 원시 GPS 로그 (개발 빌드에서만 기록)
  CREATE TABLE IF NOT EXISTS raw_points (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    latitude    REAL NOT NULL,
    longitude   REAL NOT NULL,
    accuracy    REAL,
    speed       REAL,
    timestamp   INTEGER NOT NULL,
    accepted    INTEGER NOT NULL,
    reason      TEXT
  );
  `,
];

let db: SQLite.SQLiteDatabase | null = null;

function migrate(database: SQLite.SQLiteDatabase) {
  database.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    database.withTransactionSync(() => {
      database.execSync(sql);
    });
    version += 1;
    database.execSync(`PRAGMA user_version = ${version}`);
  }
}

/**
 * DB 연결을 가져온다 (최초 호출 시 열고 마이그레이션).
 * 백그라운드 위치 태스크에서도 React 트리 없이 호출되므로 Provider 대신 모듈 싱글턴을 쓴다.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    migrate(db);
  }
  return db;
}
