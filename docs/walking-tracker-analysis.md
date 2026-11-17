# 실시간 걷기 추적 앱 기술 분석 (React Native + Mapbox)

> 작성일: 2026-11-17
> 대상: JourneyQuest 프로젝트 초기 설계
> 범위: 요구사항 정리, 기술 스택 선정, 아키텍처, 핵심 구현 방식, 리스크, 개발 로드맵

---

## 1. 개요

### 1.1 목표
사용자가 걷는 동안 **GPS 위치를 실시간으로 수집**하고, **Mapbox 지도 위에 이동 경로를 그리며**, 거리·시간·페이스·걸음 수 같은 운동 지표를 보여주는 모바일 앱(iOS/Android)을 만든다.

### 1.2 핵심 사용자 시나리오
1. 앱 실행 → 현재 위치가 지도에 표시됨
2. **[시작]** → 추적 시작, 경로가 실시간으로 그려짐
3. 화면을 끄거나 다른 앱으로 전환해도 **백그라운드에서 계속 기록**
4. **[일시정지] / [재개]**
5. **[종료]** → 요약 화면(거리, 시간, 평균 페이스, 걸음 수, 칼로리, 경로 지도)
6. 기록 목록에서 지난 걷기 기록 조회

---

## 2. 기능 요구사항

| 우선순위 | 기능 | 설명 |
|---|---|---|
| P0 | 현재 위치 표시 | Mapbox 지도 + 사용자 위치 퍽(puck), 카메라 추적 |
| P0 | 실시간 경로 기록 | 위치 수집 → 필터링 → 폴리라인 렌더링 |
| P0 | 운동 지표 | 거리, 경과 시간, 현재/평균 페이스 |
| P0 | 시작/일시정지/재개/종료 | 세션 상태 관리 |
| P0 | 백그라운드 추적 | 화면 꺼짐·앱 전환 시에도 기록 유지 |
| P0 | 로컬 저장 | 세션·좌표 영구 저장, 앱 강제종료 후 복구 |
| P1 | 기록 목록/상세 | 과거 경로 지도 재생, 통계 |
| P1 | 걸음 수 | 기기 보수계(pedometer) 센서 사용 |
| P1 | 칼로리 추정 | MET × 체중 × 시간 기반 |
| P1 | 자동 일시정지 | 일정 시간 정지 시 자동 일시정지 |
| P2 | 오프라인 지도 | 지역 타일 사전 다운로드 |
| P2 | 서버 동기화 | 계정, 클라우드 백업, 기기 간 동기화 |
| P2 | 공유 | 경로 이미지/GPX 내보내기 |
| P2 | 퀘스트/게이미피케이션 | 목표 지점 도달, 배지 등 (JourneyQuest 확장) |

### 비기능 요구사항
- **정확도**: 도시 환경에서 총 거리 오차 ±5% 이내 목표
- **배터리**: 1시간 추적 시 배터리 소모 10% 내외 목표
- **안정성**: OS에 의해 프로세스가 종료돼도 데이터 손실 최소화
- **UI 반응성**: 위치 업데이트 시 60fps 유지

---

## 3. 기술 스택 분석

### 3.1 프로젝트 기반: Expo vs React Native CLI

| 항목 | Expo (Development Build) | React Native CLI (bare) |
|---|---|---|
| 초기 설정 | 빠름, Config Plugin으로 네이티브 설정 자동화 | 수동 설정 (Podfile, Gradle, Info.plist 등) |
| Mapbox 지원 | `@rnmapbox/maps` Config Plugin 공식 지원 | 지원 |
| Expo Go 사용 | **불가** (네이티브 모듈 포함) → Dev Build 필요 | 해당 없음 |
| 빌드/배포 | EAS Build / EAS Update(OTA) | 직접 CI 구성 |
| 네이티브 커스터마이징 | Config Plugin 또는 prebuild 후 수정 | 자유로움 |

**권장: Expo + Development Build (CNG, `npx expo prebuild`)**
- Mapbox, 위치, 백그라운드 작업, 센서 모듈이 모두 Config Plugin을 제공해 네이티브 설정 실수를 줄일 수 있다.
- 필요 시 언제든 prebuild 결과물을 직접 수정하는 방식으로 bare와 동등한 자유도를 확보할 수 있다.

### 3.2 지도: `@rnmapbox/maps`

React Native용 Mapbox 라이브러리의 사실상 표준(구 `react-native-mapbox-gl`). 내부적으로 Mapbox Maps SDK(iOS/Android) v10/v11을 사용한다.

주요 사용 컴포넌트:

| 컴포넌트 | 용도 |
|---|---|
| `MapView` | 지도 본체, 스타일 URL 지정 |
| `Camera` | 사용자 추적(`followUserLocation`), 줌/피치/헤딩 제어 |
| `LocationPuck` (또는 `UserLocation`) | 현재 위치 표시 |
| `ShapeSource` + `LineLayer` | 이동 경로 폴리라인 렌더링 (GeoJSON) |
| `PointAnnotation` / `SymbolLayer` | 시작/종료 지점, 퀘스트 마커 |
| `offlineManager` | 오프라인 타일 팩 다운로드 |

> **중요**: Mapbox의 `LocationManager`/`UserLocation`은 **지도 표시용 위치**이며, 앱이 백그라운드에 있을 때 **안정적인 경로 기록 용도로는 부적합**하다. 경로 기록은 별도의 위치 추적 라이브러리를 사용하고, Mapbox는 **렌더링 전용**으로 쓰는 것이 일반적인 구조다.

#### Mapbox 계정/토큰
- **Public access token (`pk.`)**: 런타임 지도 로딩에 사용 → `Mapbox.setAccessToken()`
- **Secret/Download token (`sk.`, `DOWNLOADS:READ` scope)**: SDK 버전에 따라 네이티브 SDK 다운로드 시 필요. 사용하는 `@rnmapbox/maps` 및 Mapbox SDK 버전의 공식 설치 문서를 반드시 확인할 것.
- 토큰은 저장소에 커밋하지 않고 `.env` + EAS Secrets 등으로 관리. Public 토큰은 **URL 제한/스코프 최소화** 설정 권장.

#### 비용
- Mapbox 모바일 SDK는 **월간 활성 사용자(MAU)** 기준 과금이며 일정 무료 구간이 있다. 출시 전에 최신 요금표를 확인하고, 사용자 규모별 비용을 추정해야 한다.

### 3.3 위치 추적 라이브러리 (가장 중요한 선택)

| 항목 | `expo-location` + `expo-task-manager` | `react-native-background-geolocation` (Transistor Software) |
|---|---|---|
| 비용 | 무료 (MIT) | **Android 릴리스 빌드 유료 라이선스** (iOS·디버그는 무료) |
| 백그라운드 추적 | 지원 (`startLocationUpdatesAsync`) | 지원, 매우 안정적 |
| Android Foreground Service | 지원 (알림 표시 옵션) | 지원 |
| 움직임 감지 기반 배터리 최적화 | 제한적 | **강력** (가속도계 기반 stationary/moving 전환) |
| 앱 종료 후 재시작/부팅 후 재개 | 제한적 | 지원 (`stopOnTerminate: false`, `startOnBoot`) |
| 내장 SQLite 버퍼/HTTP 동기화 | 없음 | 있음 |
| 제조사별 배터리 최적화 대응 | 직접 처리 | 상대적으로 잘 대응 |

**권장**
- **MVP/프로토타입**: `expo-location` + `expo-task-manager` (무료, Expo 친화적, 걷기처럼 "사용자가 명시적으로 시작하는" 세션형 추적에는 충분)
- **상용 품질/장시간 추적이 핵심 가치일 때**: `react-native-background-geolocation` 도입 검토
- 위치 모듈을 `LocationProvider` 인터페이스 뒤에 숨겨서 **나중에 교체 가능하도록 설계**한다 (5.2절 참고).

### 3.4 기타 라이브러리

| 용도 | 후보 | 비고 |
|---|---|---|
| 걸음 수 | `expo-sensors` (`Pedometer`) | iOS: CoreMotion / Android: 걸음 센서. Android는 과거 구간 조회 제한 있음 |
| 건강 데이터 연동(선택) | `react-native-health`(HealthKit), `react-native-health-connect` | P2 |
| 지리 계산 | `@turf/turf` (`distance`, `length`, `simplify`) | 거리 계산·경로 단순화 |
| 상태 관리 | `zustand` | 가볍고 RN 외부(백그라운드 태스크)에서도 접근 용이 |
| 로컬 DB | `expo-sqlite` (+ `drizzle-orm` 선택) | 좌표 대량 저장에 적합 |
| 키-값 저장 | `react-native-mmkv` | 설정값, 진행 중 세션 ID |
| 내비게이션 | `expo-router` 또는 `@react-navigation/native` | |
| 알림 | `expo-notifications` | Android 13+ 알림 권한 |
| 화면 꺼짐 방지(선택) | `expo-keep-awake` | 지도 화면 유지 시 |
| 언어 | TypeScript | 필수 권장 |

---

## 4. 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                         UI Layer                             │
│  MapScreen (MapView, Camera, LocationPuck, RouteLine)        │
│  StatsPanel (거리/시간/페이스)   Controls (시작/정지/종료)    │
│  HistoryScreen / SessionDetailScreen                         │
└───────────────▲──────────────────────────────┬───────────────┘
                │ 구독(selector)                │ 액션
┌───────────────┴──────────────────────────────▼───────────────┐
│                   State Layer (zustand)                      │
│  trackingStore: status, sessionId, points(렌더용), metrics    │
└───────────────▲──────────────────────────────┬───────────────┘
                │                              │
┌───────────────┴──────────────┐ ┌─────────────▼───────────────┐
│     Tracking Service         │ │      Metrics Engine          │
│  - LocationProvider(추상화)   │ │  - 거리 누적(haversine)      │
│  - GPS 필터링 파이프라인      │ │  - 페이스/속도               │
│  - 세션 상태 머신             │ │  - 자동 일시정지 판정         │
│  - Pedometer 구독             │ │  - 칼로리 추정               │
└───────────────┬──────────────┘ └─────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│                  Persistence Layer (SQLite)                  │
│  sessions, track_points, (pause_segments)                    │
└───────────────┬──────────────────────────────────────────────┘
                │ (P2)
┌───────────────▼──────────────┐
│     Sync Service → Backend   │
└──────────────────────────────┘

[Background Task (expo-task-manager)]
   OS → 위치 배치 콜백 → 필터링 → SQLite 저장 → (앱 포그라운드면) store 갱신
```

### 핵심 설계 원칙
1. **위치 기록의 진실 공급원(Source of Truth)은 SQLite**다. 백그라운드 태스크는 React 컴포넌트 트리가 없을 수도 있으므로 메모리 상태에만 의존하면 데이터가 유실된다.
2. **Mapbox는 렌더링만 담당**한다. 위치 수집과 지도 표시를 분리한다.
3. **위치 제공자는 인터페이스로 추상화**해 `expo-location` ↔ `background-geolocation` 교체 비용을 줄인다.
4. **세션은 명시적 상태 머신**으로 관리한다 (`idle → tracking ⇄ paused → finished`).

---

## 5. 핵심 구현 상세

### 5.1 세션 상태 머신

```
        start()           pause() / autoPause
 idle ─────────▶ tracking ◀──────────────────▶ paused
                   │        resume() / autoResume │
                   │ stop()                       │ stop()
                   ▼                              ▼
                finished ◀────────────────────────┘
```

- 진행 중 세션 ID와 상태를 MMKV에 저장 → 앱이 강제 종료된 후 재실행 시 **"진행 중이던 걷기를 이어서 하시겠습니까?"** 복구 흐름 제공.
- `paused` 상태에서 수집된 좌표는 거리 계산에서 제외(또는 저장 안 함).

### 5.2 위치 제공자 추상화

```ts
// src/features/tracking/location/LocationProvider.ts
export interface RawLocation {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;      // 수평 정확도 (m)
  speed: number | null;         // m/s
  heading: number | null;
  timestamp: number;            // ms
}

export interface LocationProvider {
  requestPermissions(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
}
```

### 5.3 expo-location 기반 백그라운드 추적 예시

```ts
// src/features/tracking/location/expoLocationProvider.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { handleIncomingLocations } from '../trackingPipeline';

export const LOCATION_TASK = 'walk-location-task';

// ⚠️ 반드시 모듈 최상위(앱 진입 시점)에서 정의되어야 함 (index/_layout에서 import)
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  await handleIncomingLocations(
    locations.map((l) => ({
      latitude: l.coords.latitude,
      longitude: l.coords.longitude,
      altitude: l.coords.altitude,
      accuracy: l.coords.accuracy,
      speed: l.coords.speed,
      heading: l.coords.heading,
      timestamp: l.timestamp,
    })),
  );
});

export const expoLocationProvider = {
  async requestPermissions() {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted';
  },
  async start() {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 3,          // 3m 이동 시마다
      timeInterval: 2000,           // Android: 최소 2초 간격
      activityType: Location.ActivityType.Fitness, // iOS
      pausesUpdatesAutomatically: false,           // iOS: 자동 중단 방지
      showsBackgroundLocationIndicator: true,      // iOS: 상태바 파란 표시
      foregroundService: {                         // Android 필수
        notificationTitle: 'JourneyQuest 걷기 기록 중',
        notificationBody: '이동 경로를 기록하고 있습니다.',
        notificationColor: '#4F46E5',
      },
    });
  },
  async stop() {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  },
  isRunning: () => Location.hasStartedLocationUpdatesAsync(LOCATION_TASK),
};
```

### 5.4 GPS 필터링 파이프라인

원시 GPS는 노이즈(튐, 드리프트)가 많아 그대로 누적하면 **거리가 크게 부풀려진다**. 특히 정지 상태에서의 드리프트가 주요 원인이다.

```
RawLocation
   │
   ├─ 1) 정확도 필터:   accuracy > 25m → 버림
   ├─ 2) 시간 필터:     timestamp가 이전보다 과거/중복 → 버림
   ├─ 3) 속도 이상치:   직전 점 대비 계산 속도 > 7 m/s(≈25km/h) → 버림 (걷기 기준)
   ├─ 4) 최소 이동:     직전 점과 거리 < max(2m, accuracy*0.5) → 버림 (드리프트 억제)
   ├─ 5) (선택) 칼만 필터 / 이동 평균으로 좌표 평활화
   │
   ▼
FilteredPoint → SQLite 저장 → 거리 누적 → store 갱신
```

```ts
// src/features/tracking/filters.ts
import { haversine } from '../../lib/geo';

const MAX_ACCURACY_M = 25;
const MAX_WALK_SPEED_MS = 7;
const MIN_MOVE_M = 2;

export function acceptPoint(prev: RawLocation | null, cur: RawLocation): boolean {
  if (cur.accuracy != null && cur.accuracy > MAX_ACCURACY_M) return false;
  if (!prev) return true;
  const dt = (cur.timestamp - prev.timestamp) / 1000;
  if (dt <= 0) return false;
  const d = haversine(prev, cur);
  if (d / dt > MAX_WALK_SPEED_MS) return false;
  if (d < Math.max(MIN_MOVE_M, (cur.accuracy ?? 0) * 0.5)) return false;
  return true;
}
```

> 임계값은 **실제 필드 테스트로 튜닝**해야 한다. 상수는 설정 파일로 분리해 두는 것이 좋다.

### 5.5 지표 계산

| 지표 | 계산 방식 |
|---|---|
| 거리 | 필터 통과한 연속 점 간 haversine 거리 합 (일시정지 구간 제외) |
| 경과 시간 | 실제 이동 시간 = (종료 − 시작) − Σ(일시정지 구간) |
| 현재 페이스 | 최근 N초(예: 30초) 또는 최근 100m 구간 기준 → 분/km |
| 평균 페이스 | 경과 시간 / 총 거리 |
| 걸음 수 | `Pedometer.watchStepCount` (포그라운드), 종료 시 `getStepCountAsync(start, end)`로 보정 (iOS) |
| 칼로리 | `MET(걷기 ≈ 3.5) × 체중(kg) × 시간(h)` — 추정치임을 UI에 명시 |
| 고도 상승 | 고도 노이즈가 커서 P2로 미룸 (iOS 기압계 `Barometer` 활용 가능) |

```ts
// src/lib/geo.ts
const R = 6371e3;
export function haversine(a: { latitude: number; longitude: number },
                          b: { latitude: number; longitude: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

### 5.6 Mapbox 경로 렌더링

```tsx
// src/features/map/WalkMap.tsx
import Mapbox, { MapView, Camera, LocationPuck, ShapeSource, LineLayer } from '@rnmapbox/maps';
import { useMemo } from 'react';
import { useTrackingStore } from '../tracking/trackingStore';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

export function WalkMap() {
  const coords = useTrackingStore((s) => s.renderCoords); // [lng, lat][]
  const following = useTrackingStore((s) => s.status === 'tracking');

  const route = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(() => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  }), [coords]);

  return (
    <MapView style={{ flex: 1 }} styleURL={Mapbox.StyleURL.Outdoors} scaleBarEnabled={false}>
      <Camera followUserLocation={following} followUserMode="course" followZoomLevel={16} />
      <LocationPuck puckBearingEnabled puckBearing="course" pulsing={{ isEnabled: true }} />
      {coords.length > 1 && (
        <ShapeSource id="route" shape={route}>
          <LineLayer
            id="route-line"
            style={{ lineColor: '#4F46E5', lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
          />
        </ShapeSource>
      )}
    </MapView>
  );
}
```

> ⚠️ **좌표 순서 주의**: Mapbox/GeoJSON은 `[경도(lng), 위도(lat)]` 순서다. 가장 흔한 버그 원인.

**렌더링 성능 팁**
- 위치 업데이트마다 전체 배열을 새로 만들면 장시간 세션에서 느려진다 → 렌더용 좌표는 **throttle(예: 1초)** 해서 갱신.
- 수천 개 이상 점은 `@turf/simplify`로 렌더용만 단순화(저장 데이터는 원본 유지).
- 지표 패널과 지도를 **별도 selector로 구독**해 불필요한 리렌더 방지.
- 기록 상세 화면에서는 `Camera.fitBounds()`로 전체 경로가 보이도록 설정.

### 5.7 데이터 모델 (SQLite)

```sql
CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,        -- uuid
  status          TEXT NOT NULL,           -- tracking | paused | finished
  started_at      INTEGER NOT NULL,        -- epoch ms
  ended_at        INTEGER,
  moving_time_ms  INTEGER DEFAULT 0,
  distance_m      REAL DEFAULT 0,
  steps           INTEGER,
  calories        REAL,
  synced          INTEGER DEFAULT 0,
  created_at      INTEGER NOT NULL
);

CREATE TABLE track_points (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  latitude    REAL NOT NULL,
  longitude   REAL NOT NULL,
  altitude    REAL,
  accuracy    REAL,
  speed       REAL,
  timestamp   INTEGER NOT NULL,
  segment     INTEGER NOT NULL DEFAULT 0   -- 일시정지 후 재개 시 +1 (선 끊어 그리기용)
);
CREATE INDEX idx_points_session ON track_points(session_id, seq);

CREATE TABLE pause_segments (
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  paused_at   INTEGER NOT NULL,
  resumed_at  INTEGER
);
```

- 1시간 걷기 ≈ 1,000~2,000 점 → SQLite로 충분히 처리 가능.
- `segment` 컬럼으로 일시정지 구간을 `MultiLineString`으로 끊어서 렌더링.
- 백그라운드 콜백에서는 **배치 INSERT(트랜잭션)** 로 쓰기 비용 최소화.

### 5.8 자동 일시정지
- 최근 N초(예: 20초) 동안 이동 거리 < 5m이고 속도 < 0.5 m/s → `paused(auto)`
- 이후 연속 2~3개 점이 정상 이동으로 판정되면 자동 재개
- 사용자 설정에서 ON/OFF 가능하게

---

## 6. 플랫폼별 권한 및 설정

### 6.1 iOS (Info.plist / app.json `ios.infoPlist`)

| 키 | 용도 |
|---|---|
| `NSLocationWhenInUseUsageDescription` | 앱 사용 중 위치 |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | 백그라운드 위치 |
| `UIBackgroundModes: ["location"]` | 백그라운드 위치 업데이트 |
| `NSMotionUsageDescription` | 걸음 수(CoreMotion) |

- iOS는 "항상 허용"을 처음부터 주지 않고 **"앱 사용 중" → 이후 "항상"으로 승격**하는 2단계 흐름이 있다. 걷기 앱은 `WhenInUse` + `UIBackgroundModes location` + 추적 시작을 포그라운드에서 하면 **백그라운드 계속 수신이 가능**하므로, "항상 허용"은 필수가 아닐 수 있다 → 실제 기기에서 검증 필요.
- 권한 설명 문구는 App Store 심사에서 구체성을 요구한다 (예: "걷는 동안 이동 경로와 거리를 기록하기 위해 위치를 사용합니다.").

### 6.2 Android (AndroidManifest / app.json `android.permissions`)

| 권한 | 비고 |
|---|---|
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | 기본 |
| `ACCESS_BACKGROUND_LOCATION` | Android 10+, **별도 요청 필요**, 설정 화면 이동 |
| `FOREGROUND_SERVICE` | 포그라운드 서비스 |
| `FOREGROUND_SERVICE_LOCATION` | **Android 14+ 필수** (서비스 타입 `location`) |
| `POST_NOTIFICATIONS` | Android 13+, 포그라운드 서비스 알림 표시 |
| `ACTIVITY_RECOGNITION` | Android 10+, 걸음 센서 |

**주의사항**
- **Google Play 백그라운드 위치 정책**: `ACCESS_BACKGROUND_LOCATION` 사용 시 Play Console에서 사용 목적 신고 및 시연 영상 제출이 필요하다. 사용자가 시작한 세션 동안만 추적한다면 **포그라운드 서비스 + 포그라운드 권한만으로 구현**하여 백그라운드 위치 권한 자체를 피하는 방안을 우선 검토할 것 (심사 부담 감소).
- **제조사 배터리 최적화**(삼성, 샤오미, 화웨이 등)가 포그라운드 서비스도 종료시키는 경우가 있다 → 배터리 최적화 예외 안내 화면 제공 (참고: dontkillmyapp.com).

### 6.3 app.json 설정 예시 (Expo)

```json
{
  "expo": {
    "name": "JourneyQuest",
    "plugins": [
      ["@rnmapbox/maps", { "RNMapboxMapsVersion": "<공식 문서 권장 버전>" }],
      ["expo-location", {
        "locationWhenInUsePermission": "걷는 동안 이동 경로와 거리를 기록하기 위해 위치를 사용합니다.",
        "locationAlwaysAndWhenInUsePermission": "화면이 꺼져 있어도 걷기 기록을 계속하기 위해 위치를 사용합니다.",
        "isIosBackgroundLocationEnabled": true,
        "isAndroidBackgroundLocationEnabled": true,
        "isAndroidForegroundServiceEnabled": true
      }],
      ["expo-sensors", { "motionPermission": "걸음 수를 측정하기 위해 동작 데이터를 사용합니다." }]
    ],
    "ios": { "infoPlist": { "UIBackgroundModes": ["location"] } },
    "android": {
      "permissions": [
        "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION",
        "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_LOCATION",
        "POST_NOTIFICATIONS", "ACTIVITY_RECOGNITION"
      ]
    }
  }
}
```

> 플러그인 옵션명은 라이브러리 버전에 따라 바뀔 수 있으므로 설치 시점의 공식 문서를 기준으로 맞출 것.

---

## 7. 배터리 최적화 전략

| 전략 | 효과 |
|---|---|
| `distanceInterval` 3~5m 설정 | 정지 시 불필요한 업데이트 감소 |
| 걷기 전용 `activityType: Fitness` (iOS) | OS 레벨 최적화 |
| 지도 화면이 보이지 않을 때 렌더링 갱신 중단 | CPU/GPU 절약 |
| 자동 일시정지 시 정확도 낮추기 | GPS 칩 전력 절약 |
| SQLite 배치 쓰기 | I/O 감소 |
| 화면 꺼짐 방지는 사용자 선택 | 디스플레이 전력이 가장 큼 |

---

## 8. 권장 프로젝트 구조

```
JourneyQuest/
├── app/                         # expo-router 화면
│   ├── _layout.tsx              # TaskManager.defineTask import 위치
│   ├── index.tsx                # 지도 + 추적 화면
│   ├── history/index.tsx        # 기록 목록
│   └── history/[id].tsx         # 기록 상세
├── src/
│   ├── features/
│   │   ├── tracking/
│   │   │   ├── location/        # LocationProvider + 구현체
│   │   │   ├── filters.ts       # GPS 필터링
│   │   │   ├── metrics.ts       # 거리/페이스/칼로리
│   │   │   ├── trackingPipeline.ts
│   │   │   ├── sessionMachine.ts
│   │   │   └── trackingStore.ts # zustand
│   │   ├── map/                 # WalkMap, RouteLine, 마커
│   │   ├── pedometer/
│   │   └── history/
│   ├── db/                      # SQLite 스키마, 마이그레이션, repository
│   ├── lib/                     # geo, format(시간/거리), uuid
│   └── ui/                      # 공통 컴포넌트
├── docs/
├── app.json
└── .env                         # EXPO_PUBLIC_MAPBOX_TOKEN (커밋 금지)
```

---

## 9. 테스트 전략

| 종류 | 방법 |
|---|---|
| 단위 테스트 | Jest: `haversine`, `acceptPoint`, 지표 계산, 상태 머신 |
| 기록 재생 테스트 | 실제 걷기에서 수집한 원시 GPS 로그(JSON/GPX)를 파이프라인에 재생 → 거리 회귀 테스트 |
| 시뮬레이터 | iOS Simulator: Features → Location → City Walk / GPX 파일 · Android Emulator: Extended Controls → Routes |
| 실기기 필드 테스트 | 알려진 거리의 경로(운동장 트랙 400m 등) 반복 측정, 도심 빌딩 숲/공원/지하차도 비교 |
| 백그라운드 테스트 | 화면 끄고 30분 이상, 다른 앱 사용, 저전력 모드, 제조사별 기기 |
| 프로세스 종료 테스트 | 추적 중 앱 강제 종료 → 재실행 시 복구 확인 |

> 원시 GPS 로그를 디버그 빌드에서 **필터링 전 상태로 별도 저장**하는 기능을 초기에 만들어 두면 필터 튜닝이 훨씬 쉬워진다.

---

## 10. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| OS가 백그라운드 추적을 중단 | 경로 끊김, 데이터 손실 | 포그라운드 서비스, SQLite 즉시 저장, 복구 흐름, 필요 시 background-geolocation 도입 |
| GPS 노이즈로 거리 과대 측정 | 신뢰도 하락 | 필터링 파이프라인, 필드 테스트 기반 튜닝 |
| 제조사 배터리 최적화 | Android 일부 기기에서 추적 중단 | 배터리 최적화 예외 안내 UI |
| 스토어 심사 (위치 권한) | 출시 지연 | 권한 최소화, 명확한 설명 문구, Play 정책 신고 준비 |
| Mapbox 비용 | MAU 증가 시 비용 발생 | 무료 구간 모니터링, 요금 시뮬레이션 |
| Mapbox SDK/RN 버전 호환 | 빌드 실패 | 버전 고정, 업그레이드는 별도 브랜치에서 검증 |
| Expo Go 미지원 | 개발 흐름 혼란 | 초기부터 Dev Build 사용 (`npx expo run:ios/android` 또는 EAS) |
| 개인정보(위치 이력) | 법적/신뢰 이슈 | 로컬 우선 저장, 서버 동기화 시 암호화·동의, 개인정보 처리방침에 위치정보 명시 (국내 서비스 시 **위치정보법** 검토 필요) |

---

## 11. 개발 로드맵 (제안)

| 단계 | 기간(예상) | 산출물 |
|---|---|---|
| **0. 셋업** | 2~3일 | Expo 프로젝트, TS, Mapbox 토큰, Dev Build로 지도 표시 |
| **1. 포그라운드 추적** | 1주 | 위치 수집 → 필터 → 경로 렌더링, 거리/시간/페이스 표시 |
| **2. 세션 & 저장** | 1주 | 상태 머신, SQLite 저장, 일시정지/재개, 요약 화면 |
| **3. 백그라운드 추적** | 1주 | TaskManager, 포그라운드 서비스, 권한 흐름, 강제 종료 복구 |
| **4. 기록 & 지표 확장** | 1주 | 기록 목록/상세, 걸음 수, 칼로리, 자동 일시정지 |
| **5. 필드 테스트 & 튜닝** | 1~2주 | 실기기 테스트, 필터 튜닝, 배터리 측정, 버그 수정 |
| **6. 출시 준비** | 1주 | 권한 문구, 개인정보 처리방침, 스토어 메타데이터, 심사 |
| **7. 확장 (P2)** | - | 오프라인 지도, 서버 동기화, 공유, 퀘스트 기능 |

**MVP 범위 = 0~5단계** (약 5~7주, 1인 기준)

---

## 12. 결론 및 권장 사항

1. **Expo(Dev Build) + `@rnmapbox/maps` + `expo-location`/`expo-task-manager`** 조합으로 MVP를 시작한다.
2. **지도(Mapbox)는 렌더링 전용**, 위치 기록은 별도 위치 라이브러리 + **SQLite를 진실 공급원**으로 한다.
3. 위치 제공자를 **인터페이스로 추상화**해 두고, 백그라운드 안정성이 부족하면 `react-native-background-geolocation`으로 교체한다.
4. **GPS 필터링과 필드 테스트**가 앱 품질의 핵심이다. 원시 로그 수집 기능을 초기에 만든다.
5. Android는 **포그라운드 서비스 중심**으로 설계해 백그라운드 위치 권한/Play 심사 부담을 줄인다.
6. 라이브러리 버전·Config Plugin 옵션·Mapbox 토큰 요구사항·요금은 변동 가능성이 있으므로, **설치 시점의 공식 문서로 재확인**한다.

---

## 부록: 참고 자료
- @rnmapbox/maps: https://github.com/rnmapbox/maps
- Mapbox Maps SDK 문서: https://docs.mapbox.com/
- Expo Location: https://docs.expo.dev/versions/latest/sdk/location/
- Expo TaskManager: https://docs.expo.dev/versions/latest/sdk/task-manager/
- Expo Sensors (Pedometer): https://docs.expo.dev/versions/latest/sdk/pedometer/
- react-native-background-geolocation: https://github.com/transistorsoft/react-native-background-geolocation
- Turf.js: https://turfjs.org/
- Android 포그라운드 서비스 타입: https://developer.android.com/develop/background-work/services/fgs/service-types
- Don't kill my app: https://dontkillmyapp.com/
