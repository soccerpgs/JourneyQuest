# 소스 코드 흐름 설명

> 이 문서는 JourneyQuest 앱이 **실행되는 순서**와 **데이터가 흐르는 경로**를 소스 파일 기준으로 설명합니다.
> 설계 배경은 [walking-tracker-analysis.md](walking-tracker-analysis.md), 실행 방법은 [../README.md](../README.md) 참고.

---

## 1. 한눈에 보기

```
┌──────────────────────────── 화면 (src/app) ────────────────────────────┐
│  index.tsx (추적)     history/index.tsx (목록)     history/[id].tsx (상세) │
└──────┬──────────────────────▲───────────────────────────┬──────────────┘
       │ 버튼 → 함수 호출       │ 상태 구독 (zustand)          │ DB 직접 조회
       ▼                      │                            ▼
┌─────────────────┐    ┌──────┴────────┐          ┌─────────────────┐
│ walkController  │───▶│ trackingStore │◀─────────│    pipeline     │
│ 시작/정지/종료    │    │ (메모리 상태)   │  점 추가   │ 필터·거리·저장    │
└───┬──────┬──────┘    └───────────────┘          └───▲─────┬───────┘
    │      │                                          │     │
    │      └──────────────▶ SQLite (src/db) ◀─────────┼─────┘
    │                       진실 공급원                  │
    ▼                                                 │
┌──────────────────┐   OS가 위치 전달    ┌──────────────┴───┐
│ expoLocation     │ ═════════════════▶ │  locationTask    │
│ Provider (시작/중지)│                    │ (백그라운드 콜백)  │
└──────────────────┘                    └──────────────────┘
```

**핵심 원칙 3가지**

1. **SQLite가 진실 공급원**입니다. 위치는 들어오는 즉시 DB에 저장되고, 메모리 상태(zustand)는 화면 표시용 사본입니다. 앱이 죽어도 DB에서 복구합니다.
2. **위치 수집과 지도 표시는 분리**되어 있습니다. 위치는 `expo-location`이 수집하고, Mapbox는 그리기만 합니다.
3. **계산 로직은 순수 함수**(`filters.ts`, `sessionMath.ts`, `metrics.ts`)로 분리되어 있어 단위 테스트가 가능합니다.

---

## 2. 폴더별 역할

| 경로 | 역할 | 비고 |
|---|---|---|
| `src/app/` | 화면 (expo-router). **파일 = 화면 경로** | 라우트 외 코드는 두지 않음 |
| `src/features/tracking/` | 걷기 추적의 핵심 로직 | 이 폴더가 앱의 중심 |
| `src/features/tracking/location/` | 위치 라이브러리 연결부 | 라이브러리 교체 시 여기만 수정 |
| `src/features/map/` | Mapbox 지도 컴포넌트 | 렌더링 전용 |
| `src/features/pedometer/` | 걸음 수 센서 래퍼 | |
| `src/db/` | SQLite 연결·마이그레이션·조회/저장 | |
| `src/config/` | 튜닝 값, 환경변수 | |
| `src/lib/` | 범용 유틸 (거리 계산, 포맷, ID) | 앱 로직과 무관 |
| `src/ui/` | 공통 UI 컴포넌트, 테마 | |

---

## 3. 앱 시작 흐름

```
package.json  "main": "expo-router/entry"
   │
   ▼
src/app/_layout.tsx           ← 모든 화면보다 먼저 로드되는 루트 레이아웃
   │  ① import '@/features/tracking/location/locationTask'
   │       → TaskManager.defineTask(...)  백그라운드 위치 태스크 등록
   │  ② <Stack> 네비게이터 구성 (index / history / history/[id])
   ▼
src/app/index.tsx  (WalkScreen 마운트)
   │  useEffect (마운트 시 1회)
   │  ③ expoLocationProvider.ensurePermission()   위치 권한 요청 (지도에 내 위치 표시용)
   │  ④ restoreActiveWalk()                        중단된 걷기가 있는지 DB 확인
   │       ├ 없음        → 대기 화면 ("걷기 시작" 버튼)
   │       ├ resumed     → 위치 추적이 살아 있음 → 그대로 이어서 표시
   │       └ interrupted → 앱이 죽었다 켜짐 → "이어서 기록 / 종료하고 저장" 알림
   │  ⑤ AppState 리스너 등록 → 앱이 다시 보이면 onAppForeground() (걸음 수 구독 재개)
   ▼
화면 렌더링
```

### ① 왜 태스크를 `_layout.tsx`에서 등록하나?

OS가 백그라운드에서 위치를 보내면, 앱의 JS가 실행될 때 **이미 태스크가 정의되어 있어야** 콜백을 받을 수 있습니다. 그래서 가장 먼저 로드되는 파일의 **최상단 import**로 둡니다.

- [src/app/_layout.tsx](../src/app/_layout.tsx) — 첫 줄 import
- [src/features/tracking/location/locationTask.ts](../src/features/tracking/location/locationTask.ts) — `defineTask` 본체

### DB는 언제 열리나?

`getDb()`를 **처음 호출하는 순간** 열리고 마이그레이션이 실행됩니다 ([src/db/client.ts](../src/db/client.ts)). 보통 `restoreActiveWalk()`의 첫 조회 때입니다. React Provider가 아닌 모듈 싱글턴을 쓰는 이유는 백그라운드 태스크에서도 React 트리 없이 DB에 접근해야 하기 때문입니다.

---

## 4. "걷기 시작" 흐름

```
[걷기 시작] 버튼  (index.tsx → onStart)
   │
   ▼
walkController.startWalk()
   │  1. location.ensurePermission()            위치 권한 확인 (거부 → 'permission-denied' → 설정 열기 안내)
   │  2. requestNotificationPermission()        Android 13+ 알림 권한 (거부해도 진행)
   │  3. runExclusive( ... )                    ← 위치 처리와 겹치지 않게 줄 세우기
   │       ├ 이미 진행 중 세션 있음? → 그 세션을 이어서 사용
   │       └ 없음 → 새 Session 객체 생성 (status: 'tracking', segment 0)
   │  4. sessionsRepo.insert(session)            DB에 세션 행 생성
   │  5. trackingStore.hydrate(session, [])      화면 상태 초기화 → UI가 "기록 중"으로 바뀜
   │  6. location.start()                        OS 위치 업데이트 시작
   │       └ 실패 시 세션 삭제 + 상태 초기화 후 에러 표시
   │  7. pedometer.start(onStepDelta)            걸음 수 구독
   ▼
이후 위치는 5장의 흐름으로 들어옴
```

`location.start()` 내부 ([expoLocationProvider.ts](../src/features/tracking/location/expoLocationProvider.ts)):

```ts
Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
  accuracy: BestForNavigation,
  distanceInterval: 3,        // 3m 이동마다
  timeInterval: 2000,         // (Android) 최소 2초 간격
  activityType: Fitness,      // (iOS) 걷기/운동 최적화
  foregroundService: { ... }, // (Android) 상단 알림 → 화면 꺼져도 유지
});
```

---

## 5. 위치 1건이 화면에 그려지기까지 (가장 중요한 흐름)

```
OS (GPS)
   │  여러 위치를 배치로 전달 (앱이 백그라운드여도)
   ▼
locationTask.ts   TaskManager 콜백
   │  LocationObject[] → RawLocation[] 변환 (toRawLocation)
   ▼
pipeline.enqueueLocations(raw[])
   │  Promise 큐에 넣어 **한 번에 한 배치씩** 처리 (콜백이 겹쳐도 순서 보장)
   ▼
pipeline.processBatch()
   │  a. 시간순 정렬, 마지막 위치를 store.lastFix 에 저장 (GPS 정확도 배지용)
   │  b. sessionsRepo.getActive()        진행 중 세션 조회
   │       └ 없거나 'paused' 면 → 여기서 종료 (일시정지 중 좌표는 버림)
   │  c. pointsRepo.last()               같은 구간(segment)의 직전 점 = 필터 기준점
   │  d. 각 위치마다:
   │       ├ 재개 시점보다 오래된 캐시 위치 → 버림 ('stale')
   │       ├ filters.evaluatePoint(prev, cur)   ── 6장
   │       │     └ 버림 → rawLog 에만 기록
   │       └ 채택 →
   │            sessionMath.autoPauseForGap()  긴 공백이면 자동 일시정지 시간 확정
   │            distanceM += 이동 거리
   │            lastActivityAt = 이 점의 시각
   │            TrackPoint 생성 (seq, segment 부여)
   │  e. 화면에서 센 걸음 수가 더 크면 세션에 반영
   │  f. DB 트랜잭션: track_points INSERT + (개발빌드) raw_points INSERT + sessions UPDATE
   │  g. trackingStore.onPointsAccepted(session, points)
   ▼
trackingStore  (zustand)
   │  session 교체, segments 에 좌표 추가, recentPoints 갱신
   ▼
구독 중인 컴포넌트 리렌더
   ├ WalkMap        segments → routeFeature() → MultiLineString → <LineLayer> 경로 그리기
   ├ useLiveMetrics 거리/시간/페이스/칼로리 재계산
   └ GPS 배지       lastFix.accuracy 표시
```

관련 파일:
- [pipeline.ts](../src/features/tracking/pipeline.ts) — 위 a~g 전부
- [trackingStore.ts](../src/features/tracking/trackingStore.ts) — `onPointsAccepted`, `appendToSegments`
- [WalkMap.tsx](../src/features/map/WalkMap.tsx), [routeGeoJson.ts](../src/features/map/routeGeoJson.ts)

> **좌표 순서 주의**: DB/로직은 `latitude, longitude` 이지만 Mapbox(GeoJSON)는 `[경도, 위도]` 입니다. 변환은 `trackingStore.appendToSegments` 와 `routeGeoJson.segmentsFromPoints` 에서만 합니다.

### 왜 큐(`enqueueLocations` / `runExclusive`)가 필요한가?

위치 콜백은 비동기라 동시에 여러 개가 실행될 수 있습니다. 둘이 동시에 "직전 점"을 읽으면 같은 구간 거리를 두 번 더하는 문제가 생깁니다. 그래서 **위치 처리와 시작/일시정지/종료 같은 상태 변경을 모두 하나의 Promise 큐**로 직렬화합니다.

---

## 6. GPS 필터 (`filters.ts`)

`evaluatePoint(prev, cur, cfg)` 는 순서대로 검사하고, 처음 걸리는 사유로 버립니다.

| 순서 | 검사 | 버리는 조건 (기본값) | 사유 코드 |
|---|---|---|---|
| 1 | 정확도 | `accuracy > 25m` | `accuracy` |
| – | 첫 점 | (prev 없음) → **채택, 거리 0** | |
| 2 | 시간 | 직전 점보다 같거나 과거 | `stale` |
| 3 | 속도 | 직전 점 대비 `> 7m/s` (≈25km/h) | `speed` |
| 4 | 최소 이동 | `< max(2m, accuracy × 0.5)` (드리프트) | `jitter` |

통과하면 `{ accepted: true, distanceM }` 을 반환합니다. 기준값은 [src/config/tracking.ts](../src/config/tracking.ts) 에서 조정합니다.

개발 빌드에서는 버린 점까지 `raw_points` 테이블에 사유와 함께 저장되므로, 필드 테스트 후 DB를 열어 필터 튜닝에 사용할 수 있습니다.

---

## 7. 시간 계산과 일시정지 (`sessionMath.ts`)

### 세션의 시간 관련 필드

| 필드 | 의미 |
|---|---|
| `startedAt` / `endedAt` | 시작/종료 시각 |
| `manualPausedMs` | 사용자가 [일시정지]한 누적 시간 |
| `autoPausedMs` | 자동 일시정지로 확정된 누적 시간 |
| `pausedAt` | 현재 수동 일시정지 중이면 그 시작 시각 |
| `lastActivityAt` | 마지막 유효 이동(또는 시작/재개) 시각 |
| `currentSegment` | 재개할 때마다 +1 → 지도에서 선을 끊어 그림 |

### 이동 시간 공식

```
이동 시간 = (종료 또는 현재 − 시작)
          − manualPausedMs − autoPausedMs
          − (수동 일시정지 중이면 지금까지의 일시정지 시간)
          − (미확정 자동 일시정지: 마지막 활동 후 30초 넘게 지났으면 그 공백 전체)
```

### 자동 일시정지

- **화면 표시 중**: `lastActivityAt` 이후 30초 이상 새 유효 점이 없으면 → "자동 일시정지" 표시, 그 공백은 이동 시간에서 제외 (`pendingAutoPauseMs`)
- **새 점이 도착했을 때**: 공백이 30초를 넘으면 `autoPauseForGap` 이 판정
  - 공백 동안 평균 속도 `< 0.5m/s` → 멈춰 있었음 → 공백 전체를 `autoPausedMs` 에 확정
  - 평균 속도 `≥ 0.5m/s` → 터널 등 GPS 끊김 중 걸은 것 → 이동 시간으로 인정
- 이 방식은 **타이머 없이 점 도착 시점에 소급 계산**하므로, JS 타이머가 멈추는 백그라운드에서도 정확합니다.

### 상태 전이 함수 (모두 새 객체를 반환하는 순수 함수)

```
          pauseSession()                    finishSession()
tracking ───────────────▶ paused ─────────────────────────▶ finished
   ▲                        │                                  ▲
   └──── resumeSession() ───┘                                  │
   │   (segment +1, lastActivityAt = now)                      │
   └───────────────────────── finishSession() ─────────────────┘
```

- `pauseSession` — 미확정 자동 일시정지를 먼저 확정한 뒤 `paused`
- `resumeSession` — 일시정지 시간을 `manualPausedMs` 에 누적, 구간 +1
- `finishSession` — 남은 일시정지 시간 확정 후 `finished`, `endedAt` 기록

---

## 8. 일시정지 · 재개 · 종료 흐름 (`walkController.ts`)

모든 함수는 `runExclusive()` 로 위치 처리와 직렬화됩니다.

| 동작 | 처리 | 위치 서비스 |
|---|---|---|
| **일시정지** `pauseWalk` | `pauseSession` → DB 저장 → store 갱신 (걸음 수도 저장) | **유지** ※ |
| **재개** `resumeWalk` | `resumeSession` → DB 저장 → `location.start()` (꺼져 있으면 켬) | 켜짐 |
| **종료** `finishWalk` | 위치·걸음 중지 → `finishSession` → 걸음 수 확정 → 칼로리 계산 → DB 저장 → store 초기화 → 세션 ID 반환 | 중지 |
| **삭제** `discardWalk` | 위치·걸음 중지 → 세션 DELETE (점은 CASCADE 삭제) → store 초기화 | 중지 |

※ **일시정지 중에도 위치 서비스를 끄지 않는 이유**: Android는 앱이 백그라운드일 때 포그라운드 서비스를 새로 시작할 수 없습니다. 끄면 백그라운드에서 재개할 방법이 없으므로, 켜둔 채 `pipeline` 에서 `paused` 상태의 좌표를 무시합니다.

종료 후 화면 흐름 (index.tsx):

```
[종료] → Alert "걷기를 종료할까요?"
   ├ 계속 걷기   → 아무것도 안 함
   ├ 기록 삭제   → discardWalk()          (10m 미만일 때만 표시)
   └ 종료하고 저장 → finishWalk() → router.push('/history/[id]') 상세 화면으로 이동
```

---

## 9. 앱이 죽었다가 다시 켜졌을 때 (복구)

```
앱 시작 → index.tsx → restoreActiveWalk()
   │  DB: status IN ('tracking','paused') 인 세션 조회
   │  OS: 위치 태스크가 아직 실행 중인지 확인
   │
   ├ 세션 없음 + 태스크 실행 중  → 주인 없는 태스크 → location.stop() 정리
   ├ 세션 없음                  → { kind: 'none' }
   ├ 세션 있음 + 태스크 실행 중  → { kind: 'resumed' }      (예: 개발 중 JS 리로드)
   │                              DB의 점들로 store 복원, 걸음 구독 재개
   └ 세션 있음 + 태스크 없음     → { kind: 'interrupted' }  (앱이 OS에 의해 종료됨)
                                  store 복원 후 사용자에게 질문
                                    ├ 이어서 기록 → continueInterruptedWalk()
                                    │     마지막 활동 시각부터 지금까지를 일시정지로 처리하고 재개
                                    └ 종료하고 저장 → finishWalk()
```

---

## 10. 걸음 수 흐름 (`pedometer.ts`)

```
pedometer.start(onStepDelta)
   │  Pedometer.watchStepCount → "구독 이후 누적 걸음" 이 들어옴
   │  직전 값과의 차이(delta)만 계산
   ▼
onStepDelta(delta)   (walkController)
   │  세션이 'tracking' 일 때만 → store.addSteps(delta)   (일시정지 중 걸음은 무시)
   ▼
store.liveSteps  → 화면 표시
   │  위치 배치 처리 때 / 일시정지 때 DB에 함께 저장
   ▼
종료 시: steps = max(화면에서 센 값, DB 값, iOS OS 기록값)
         iOS: Pedometer.getStepCountAsync(시작, 종료) 로 백그라운드 구간까지 보정
         Android: 백그라운드 구간은 집계 불가 (알려진 제약)
```

---

## 11. 화면별 데이터 출처

| 화면 | 파일 | 데이터 출처 | 갱신 방식 |
|---|---|---|---|
| 추적 | [index.tsx](../src/app/index.tsx) | **zustand store** | 위치 도착 시 + 1초 타이머(`useNow`) |
| 기록 목록 | [history/index.tsx](../src/app/history/index.tsx) | **SQLite** `listFinished()` | 화면 포커스 시마다 (`useFocusEffect`) |
| 기록 상세 | [history/[id].tsx](../src/app/history/[id].tsx) | **SQLite** `get(id)` + `listBySession(id)` | 진입 시 1회 |

추적 화면의 실시간 지표는 [useLiveMetrics.ts](../src/features/tracking/useLiveMetrics.ts) 한 곳에서 계산합니다.

```
store.session ──┬─▶ movingTimeMs()         → 시간
                ├─▶ averagePaceSecPerKm()  → 평균 페이스
                ├─▶ isAutoPaused()         → "자동 일시정지" 표시
                └─▶ estimateCalories()     → 칼로리
store.recentPoints ─▶ currentPaceSecPerKm() → 현재 페이스 (최근 60초, 같은 구간)
store.liveSteps ────▶ 걸음
```

### 지도 컴포넌트 두 가지

| | `WalkMap` (추적 화면) | `RouteMap` (상세 화면) |
|---|---|---|
| 카메라 | `Viewport` followPuck — 내 위치를 따라감 | `Camera bounds` — 전체 경로가 보이게 맞춤 |
| 사용자 조작 | 지도를 움직이면 따라가기 해제 → "◎ 내 위치" 버튼 | 자유롭게 조작 |
| 표시 | 내 위치 퍽 + 경로 선 | 경로 선 + 시작(초록)/종료(빨강) 점 |
| 토큰 없음 | `MissingTokenNotice` 안내 표시 (기록 기능은 정상) | 동일 |

---

## 12. 데이터 저장 구조 (SQLite)

```
sessions (1) ───< track_points (N)     ON DELETE CASCADE
         (1) ───< raw_points   (N)     개발 빌드에서만 기록
```

| 테이블 | 주요 컬럼 | 용도 |
|---|---|---|
| `sessions` | id, status, started_at, ended_at, distance_m, manual/auto_paused_ms, paused_at, last_activity_at, current_segment, steps, calories | 걷기 1회 |
| `track_points` | session_id, seq, segment, latitude, longitude, accuracy, speed, timestamp | 필터 통과한 경로 점 |
| `raw_points` | session_id, latitude, longitude, accuracy, timestamp, accepted, reason | 필터 튜닝용 원시 로그 |

- 마이그레이션은 [client.ts](../src/db/client.ts) 의 `MIGRATIONS` 배열에 **추가만** 합니다 (`PRAGMA user_version` 으로 버전 관리).
- DB 행(snake_case) ↔ 앱 객체(camelCase) 변환은 각 repo 파일의 `fromRow` / `params` 에서 합니다.

---

## 13. 자주 하게 될 수정과 위치

| 하고 싶은 것 | 수정할 곳 |
|---|---|
| 필터 기준, 자동 일시정지 시간 조정 | [src/config/tracking.ts](../src/config/tracking.ts) |
| 위치 업데이트 간격/정확도 변경 | `TRACKING_CONFIG.location`, [expoLocationProvider.ts](../src/features/tracking/location/expoLocationProvider.ts) |
| 위치 라이브러리 교체 (예: background-geolocation) | `LocationProvider` 인터페이스의 새 구현체 작성 → [walkController.ts](../src/features/tracking/walkController.ts) 상단 `location` 교체 |
| 새 지표 추가 | 계산은 [metrics.ts](../src/features/tracking/metrics.ts) (+ 테스트), 표시는 [useLiveMetrics.ts](../src/features/tracking/useLiveMetrics.ts) → index.tsx |
| 세션에 컬럼 추가 | `MIGRATIONS` 에 `ALTER TABLE` 추가 → `types.ts` `Session` → `sessionsRepo` 의 `fromRow`/`params`/SQL |
| 새 화면 추가 | `src/app/` 에 파일 생성 → `_layout.tsx` 에 `Stack.Screen` 옵션 |
| 지도 스타일 변경 | [mapbox.ts](../src/features/map/mapbox.ts) `MAP_STYLE_URL` |
| 권한 문구 변경 | `app.json` 의 `expo-location` / `expo-sensors` 플러그인 옵션 (→ 네이티브 재빌드 필요) |

---

## 14. 테스트 범위

`npm test` 로 실행되는 단위 테스트는 **순수 함수**만 대상으로 합니다.

| 테스트 파일 | 대상 |
|---|---|
| `src/lib/__tests__/geo.test.ts` | haversine 거리, 경계 상자 |
| `src/lib/__tests__/format.test.ts` | 거리/시간/페이스 표시 형식 |
| `src/features/tracking/__tests__/filters.test.ts` | GPS 필터 4단계 |
| `src/features/tracking/__tests__/sessionMath.test.ts` | 이동 시간, 자동 일시정지, 상태 전이 |
| `src/features/tracking/__tests__/metrics.test.ts` | 평균/현재 페이스, 칼로리 |
| `src/features/map/__tests__/routeGeoJson.test.ts` | 구간 분리, GeoJSON 변환 |

`pipeline`, `walkController`, 화면 컴포넌트는 네이티브 모듈(위치, SQLite, Mapbox)에 의존하므로 단위 테스트 대신 **에뮬레이터 경로 재생과 실기기 테스트**로 확인합니다.
