# JourneyQuest

React Native(Expo) + MapLibre(OpenStreetMap) 기반 실시간 걷기 추적 앱.
설계 배경은 [docs/walking-tracker-analysis.md](docs/walking-tracker-analysis.md) 참고.

## 기능

- 지도 위 현재 위치 표시 및 실시간 경로 그리기 (지도 이동 시 "내 위치" 버튼으로 복귀)
- 거리 / 이동 시간 / 평균·현재 페이스 / 걸음 수 / 칼로리(추정)
- 시작 · 일시정지 · 재개 · 종료, **자동 일시정지** (30초 이상 정지 시)
- **화면이 꺼져도 계속 기록** (Android 포그라운드 서비스 알림, iOS 백그라운드 위치)
- GPS 노이즈 필터 (정확도 · 비정상 속도 · 드리프트)
- 앱이 강제 종료된 경우 다음 실행 시 **이어서 기록 / 저장** 선택
- 기록 목록 · 상세(전체 경로 지도, 시작/종료 지점) · 삭제
- 모든 데이터는 기기 내 SQLite에 저장 (서버 없음)

## 기술 스택

| 영역 | 사용 |
|---|---|
| 프레임워크 | Expo SDK 58 (Development Build), React Native 0.88, TypeScript |
| 라우팅 | expo-router (`src/app/`) |
| 지도 | @maplibre/maplibre-react-native 11 + OpenFreeMap / OSM 타일 (API 키 없음) |
| 위치 | expo-location + expo-task-manager |
| 걸음 수 | expo-sensors (Pedometer) |
| 저장 | expo-sqlite |
| 상태 | zustand |
| 테스트 | jest-expo |

## 시작하기

### 1. 요구사항

- **Node.js 20 이상** (이 PC의 기본 `node`는 v12이므로 `nvm use 24.16.0` 등으로 전환 필요)
- Android: Android Studio + SDK (로컬 빌드 시) / iOS: macOS + Xcode (로컬 빌드 시)
- 또는 로컬 SDK 없이 **EAS Build** 사용

### 2. 설치

```bash
npm install
```

> 지도는 API 키·토큰 없이 동작합니다. 지도 왼쪽 위 선택 박스에서 **1. MapLibre**(OpenFreeMap, 보행로 강조) / **2. OpenStreetMap**(OSM 표준 타일, 비교용)을 고를 수 있습니다.
> OSM 표준 타일은 [OSMF 타일 정책](https://operations.osmfoundation.org/policies/tiles/)상 출시 앱·오프라인 저장에 쓸 수 없으므로 개발 중 비교용으로만 사용합니다.

### 3. 개발 빌드 실행

지도·백그라운드 위치·걸음 센서는 네이티브 모듈이라 **Expo Go에서는 동작하지 않습니다.**

```bash
# 로컬 빌드 (Android SDK / Xcode 필요)
npm run android
npm run ios

# 또는 클라우드 빌드 후 기기에 설치
npx eas-cli@latest build --profile development --platform android

# 개발 서버 (개발 빌드 앱이 접속)
npm start
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm start` | 개발 서버 (dev client) |
| `npm run android` / `ios` | 네이티브 빌드 후 실행 |
| `npm test` | 단위 테스트 |
| `npm run typecheck` | 타입 체크 |
| `npm run lint` | ESLint |
| `npm run doctor` | Expo 의존성/설정 진단 |

## 프로젝트 구조

```
src/
├── app/                          # 화면 (expo-router)
│   ├── _layout.tsx               # 루트 Stack + 백그라운드 위치 태스크 등록
│   ├── index.tsx                 # 지도 + 실시간 추적
│   └── history/
│       ├── index.tsx             # 기록 목록
│       └── [id].tsx              # 기록 상세
├── config/
│   └── tracking.ts               # 필터·자동 일시정지 튜닝 값
├── db/                           # SQLite 연결·마이그레이션·저장소
├── features/
│   ├── tracking/
│   │   ├── location/             # LocationProvider 추상화, expo-location 구현, 백그라운드 태스크
│   │   ├── filters.ts            # GPS 노이즈 필터 (순수 함수)
│   │   ├── sessionMath.ts        # 이동 시간·일시정지·상태 전이 (순수 함수)
│   │   ├── metrics.ts            # 페이스·칼로리 (순수 함수)
│   │   ├── pipeline.ts           # 위치 배치 → 필터 → DB 저장 → 상태 갱신 (직렬 처리)
│   │   ├── walkController.ts     # 시작/일시정지/재개/종료/복구
│   │   ├── trackingStore.ts      # zustand 상태
│   │   └── useLiveMetrics.ts     # 실시간 지표 훅
│   ├── map/                      # WalkMap(실시간), RouteMap(기록), 지도 선택, GeoJSON 변환
│   └── pedometer/                # 걸음 수 센서 래퍼
├── lib/                          # 거리 계산, 포맷, ID
└── ui/                           # 공통 컴포넌트, 테마
```

### 데이터 흐름

```
OS 위치 업데이트 ─▶ locationTask (백그라운드 가능)
                     └▶ pipeline: 필터 → 거리 누적 → 자동 일시정지 판정
                           ├▶ SQLite (진실 공급원)
                           └▶ zustand store ─▶ 지도/통계 UI
```

- 위치 기록의 기준은 SQLite입니다. 백그라운드에서도 바로 저장되므로 앱이 종료돼도 기록이 남습니다.
- 일시정지 중에도 위치 서비스는 유지합니다. Android는 백그라운드에서 포그라운드 서비스를 다시 시작할 수 없기 때문입니다. 일시정지 중 들어온 좌표는 무시됩니다.

## 권한 설계

| 플랫폼 | 요청하는 권한 | 비고 |
|---|---|---|
| iOS | 위치 "앱 사용 중", 동작(걸음 수) | `UIBackgroundModes: location` 으로 화면 꺼짐 중에도 기록. **"항상 허용"은 요청하지 않음** |
| Android | 정확한 위치, 활동 인식, 알림(13+) | 포그라운드 서비스(`FOREGROUND_SERVICE_LOCATION`)로 기록. **`ACCESS_BACKGROUND_LOCATION`은 명시적으로 제외** → Play 백그라운드 위치 심사 대상 아님 |

## 알려진 제약

- **Android 걸음 수**: 센서 API 특성상 앱이 화면에 보일 때만 집계됩니다. iOS는 종료 시 OS 기록으로 전체 구간을 보정합니다.
- **앱 강제 종료**: OS가 앱을 종료하면 그동안은 기록되지 않습니다. 다음 실행 시 이어서 기록할 수 있으며, 꺼져 있던 시간은 일시정지로 처리됩니다.
- **칼로리**: 체중 65kg 고정값으로 추정합니다 (설정 화면 미구현).
- **제조사 배터리 최적화** (삼성·샤오미 등): 포그라운드 서비스가 종료될 수 있습니다. 배터리 최적화 예외 안내 UI는 아직 없습니다.
- 필터 임계값(`src/config/tracking.ts`)은 실기기 필드 테스트로 튜닝해야 합니다. 개발 빌드에서는 필터 전 원시 GPS가 `raw_points` 테이블에 함께 저장됩니다.

## 테스트

```bash
npm test
```

순수 로직(거리 계산, GPS 필터, 이동 시간/자동 일시정지, 페이스·칼로리, GeoJSON 변환, 포맷)을 단위 테스트합니다.
실제 위치 동작은 시뮬레이터(iOS: Features → Location → City Walk / Android 에뮬레이터: Extended Controls → Routes)와 실기기에서 확인하세요.
