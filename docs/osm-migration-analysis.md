# Mapbox → OpenStreetMap 전환 분석

> 현재 지도(`@rnmapbox/maps` + Mapbox Outdoors 스타일)를 OpenStreetMap 기반 지도로 바꿀 때 **무엇을 결정해야 하고, 어떤 파일을 고쳐야 하는지** 정리한 문서입니다.
> 코드 구조는 [code-flow.md](code-flow.md), 초기 설계는 [walking-tracker-analysis.md](walking-tracker-analysis.md) 참고.
>
> 작성 기준: 2026-11-19, Expo SDK 58 / React Native 0.88 / `@rnmapbox/maps` 10.3 / `@maplibre/maplibre-react-native` 11.5.1

> ✅ **진행 상황 (2026-11-19):** MapLibre로 전환을 마쳤고 `@rnmapbox/maps`는 제거했습니다. 앱에서 **1. MapLibre(OpenFreeMap)** / **2. OpenStreetMap(비교용)** 중 고를 수 있습니다.
> 처음에는 Mapbox까지 셋 중에서 고르게 하려 했지만, 두 라이브러리에 같은 이름의 TurboModule 스펙(`NativeMapViewModule.ts`)이 있어서 Android 빌드가 C++ 링크 단계에서 `duplicate symbol: NativeMapViewModuleSpecJSI` 오류로 실패했습니다. 그래서 Mapbox를 뺐습니다. 현재 구조는 [code-flow.md](code-flow.md)의 "지도 선택" 절 참고.

---

## 1. 먼저 알아야 할 것

### 1.1 "OSM으로 바꾼다"는 두 가지를 바꾸는 일이다

| 층 | 현재 | 바꿀 대상 |
|---|---|---|
| **렌더러** (지도를 그리는 네이티브 SDK) | Mapbox Maps SDK (`@rnmapbox/maps`) | MapLibre Native (`@maplibre/maplibre-react-native`) |
| **타일·스타일** (무엇을 어떻게 그릴지) | Mapbox Outdoors (`mapbox://styles/...`) | OSM 데이터 기반 타일 (OpenFreeMap, MapTiler, Stadia, 자체 호스팅 등) |

Mapbox SDK에 OSM 타일만 올리는 것도 기술적으로는 가능하지만, Mapbox SDK는 **타일 출처와 관계없이 액세스 토큰과 MAU 과금**이 따라옵니다. "토큰·과금 없이 OSM"이 목적이라면 렌더러도 MapLibre로 바꾸는 것이 정석입니다. MapLibre는 Mapbox GL의 오픈소스 포크라서 스타일 스펙과 API 모양이 거의 같습니다.

### 1.2 인도(보행로) 문제에 대한 기대치

전환의 계기는 "인도가 안 보인다"였습니다. 하지만 **Mapbox의 한국 데이터도 상당 부분 OSM에서 옵니다.** 렌더러를 바꿔도 데이터가 같으면 결과도 같습니다. 차이는 **스타일이 보행로를 얼마나 적극적으로 그리느냐**에서 납니다.

| 타일·스타일 | 보행로 표시 | 비고 |
|---|---|---|
| OSM 표준(Carto) 래스터 `tile.openstreetmap.org` | z16 이상에서 `footway`/`path`를 점선으로 그림 | 보행로가 가장 잘 보이지만 **앱 서비스에 사용 제한** (2.2 참고) |
| OpenFreeMap (OpenMapTiles 스키마, 벡터) | `transportation` 레이어의 `class=path`로 포함 | 기본 스타일은 흐리게 그림 → 스타일 수정으로 강조 가능 |
| MapTiler / Stadia (벡터) | OpenMapTiles 계열이라 위와 같음 | 유료(무료 구간 있음), API 키 필요 |

**결론:** OSM에 인도가 **별도 선(`highway=footway` + `footway=sidewalk`)으로 그려져 있는 지역**이라면 MapLibre + 스타일 수정으로 보이게 만들 수 있습니다. 한국 도심처럼 차도에 `sidewalk=both` 속성만 붙어 있는 곳은 어떤 OSM 지도로도 인도 선이 나오지 않습니다.

> ✅ **전환 전에 꼭 확인하세요:** 실제로 걷는 지역을 [openstreetmap.org](https://www.openstreetmap.org)에서 z17~18로 확대해 봅니다. 인도가 점선으로 보이면 전환하는 효과가 있습니다. 차도만 보인다면 전환해도 인도 문제는 해결되지 않습니다. 그때는 국내 지도 SDK(네이버·카카오·T맵)를 검토해야 합니다.

> ⚠️ OpenMapTiles 스키마가 `footway=sidewalk`(인도)를 일반 `footway`(보행로)와 구분해서 담는지는 확인하지 못했습니다. 인도만 골라 그려야 한다면 PoC에서 실제 타일 속성을 찍어 확인해야 합니다.

---

## 2. 선택지

### 2.1 타일 제공자 비교

| | OpenFreeMap | MapTiler / Stadia | OSM 표준 래스터 | 자체 호스팅 (PMTiles 등) |
|---|---|---|---|---|
| 형식 | 벡터 | 벡터 | 래스터 PNG | 벡터 |
| API 키 | **없음** | 필요 | 없음 | 없음 |
| 비용 | 무료 (후원 운영) | 무료 구간 + 유료 | 무료 | 서버·트래픽 비용 |
| 상용 앱 | 허용 | 허용 | **비권장** (언제든 차단 가능) | 허용 |
| 오프라인 다운로드 | 1회 3,000타일 / 50MB 이하 허용 | 요금제별 | **금지** | 자유 |
| SLA | 없음 | 있음(유료) | 없음 | 직접 책임 |
| 스타일 URL | `https://tiles.openfreemap.org/styles/liberty` (그 외 `bright`, `positron`) | 제공자 대시보드 | 직접 래스터 스타일 JSON 작성 | 직접 작성 |

### 2.2 OSM 표준 타일(`tile.openstreetmap.org`)을 쓰면 안 되는 이유

OSMF 타일 사용 정책 요약:
- 기부로 운영되며 **SLA가 없고, 정책 위반 시 예고 없이 차단**합니다.
- 앱 이름이 들어간 **고유한 User-Agent가 필수**입니다. 라이브러리 기본값(okhttp 등)은 차단됩니다.
- **오프라인·미리 받기 금지.** 기획서의 P2 "오프라인 지도"와 정면으로 충돌합니다.
- 상용 서비스는 "언제든 접근이 철회될 수 있음"을 감수해야 합니다.

→ **개발 중에 보행로가 어떻게 보이는지 비교하는 용도로만** 쓰고, 출시 빌드에는 쓰지 않습니다.

### 2.3 권장안

**MapLibre React Native + OpenFreeMap `liberty` 스타일 + 보행로 강조 레이어 추가**

- API 키·토큰이 없어져 `.env.local`과 EAS 환경 변수 관리가 사라집니다.
- 나중에 MapTiler나 자체 호스팅으로 옮기더라도 스타일 URL만 바꾸면 됩니다.
- SLA가 필요해지면 그때 유료 제공자로 바꿉니다.

---

## 3. 라이브러리 교체: `@rnmapbox/maps` → `@maplibre/maplibre-react-native`

### 3.1 호환성

| 항목 | 요구 사항 | 이 프로젝트 |
|---|---|---|
| React Native | ≥ 0.80 | 0.88.1 ✅ |
| 아키텍처 | v11부터 **New Architecture 전용** | RN 0.88 기본값 ✅ |
| Android API | ≥ 23 | Expo 58 기본값 ✅ |
| Expo Go | **지원 안 함** | 이미 dev client 사용 중 ✅ |
| Config Plugin | `@maplibre/maplibre-react-native` | iOS는 필수 (Podfile `post_install` 주입) |

설치 후 `npx expo-doctor`로 SDK 58과의 호환성을 확인합니다.

### 3.2 API 대응표 (이 프로젝트에서 쓰는 것만)

MapLibre RN v11은 MapLibre GL JS 이름 체계로 크게 바뀌었습니다. 이 프로젝트에서 쓰는 API는 아래와 같이 대응됩니다.

| 현재 (`@rnmapbox/maps`) | MapLibre RN v11 | 사용 위치 |
|---|---|---|
| `Mapbox.setAccessToken()` | **없음** (삭제) | `mapbox.ts` |
| `Mapbox.StyleURL.Outdoors` | `mapStyle="https://…/style.json"` (필수 prop) | `mapbox.ts` |
| `<MapView styleURL=…>` | `<Map mapStyle=…>` | WalkMap, RouteMap |
| `logoPosition`, `attributionPosition` | `attributionPosition` (로고 없음) ⚠️ 이름 확인 필요 | WalkMap |
| `onDidFinishLoadingMap` | 대응 이벤트 확인 필요 (`onDidFinishLoadingMap` 또는 `onDidFinishLoadingStyle`) ⚠️ | WalkMap |
| `<Camera defaultSettings={{ centerCoordinate, zoomLevel }}>` | `<Camera initialViewState={{ center, zoom }}>` | WalkMap |
| `camera.setCamera({ centerCoordinate, zoomLevel, animationDuration: 0 })` | `camera.jumpTo({ center, zoom })` | WalkMap |
| `<Camera bounds={{ ne, sw, padding… }} maxZoomLevel>` | `camera.fitBounds([w, s, e, n], { padding })` 또는 `initialViewState={{ bounds }}` + `maxZoom` | RouteMap |
| `<Viewport>` + `transitionTo({ kind: 'followPuck' })` | `<Camera trackUserLocation="heading" padding={{ bottom }}>` | WalkMap |
| `Viewport.onStatusChanged` (`reason === 'UserInteraction'`) | `Camera.onTrackUserLocationChange` (`null`이면 추적 해제) | WalkMap |
| `<LocationPuck puckBearing="heading" pulsing>` | `<NativeUserLocation>` (pulsing 옵션 없음 ⚠️) | WalkMap |
| `<ShapeSource shape={…}>` | `<GeoJSONSource data={…}>` | WalkMap, RouteMap |
| `<LineLayer style={{ lineColor… }}>` | `<Layer type="line" paint={{ 'line-color'… }} layout={{ 'line-cap'… }}>` | WalkMap, RouteMap |
| `<CircleLayer style={{ circleColor… }}>` | `<Layer type="circle" paint={{ 'circle-color'… }}>` | RouteMap |

> ⚠️ 표시한 항목은 문서에서 정확한 이름이나 동작을 확인하지 못한 부분입니다. 구현할 때 [MapLibre RN 컴포넌트 문서](https://maplibre.org/maplibre-react-native/docs/components/map)와 v11 마이그레이션 가이드로 확인하세요.

### 3.3 가장 큰 변경: WalkMap의 "따라가기"

현재 [WalkMap.tsx](../src/features/map/WalkMap.tsx)는 Mapbox 전용인 **Viewport API**에 의존합니다.

```
follow() → viewport.transitionTo(followPuck) → 실패 시 1.5초 간격 최대 5회 재시도
onStatusChanged(idle, UserInteraction) → following=false → "◎ 내 위치" 버튼 표시
```

MapLibre에는 Viewport가 없고, Camera의 상태 prop으로 처리합니다. 재시도 로직(`FOLLOW_RETRY_MS`, `FOLLOW_MAX_RETRIES`, `retryTimer`)이 필요 없어져 코드가 오히려 단순해집니다.

```tsx
const [tracking, setTracking] = useState<TrackUserLocation | undefined>('heading');

<Camera
  ref={cameraRef}
  initialViewState={{ center: FALLBACK_CENTER, zoom: 14 }}
  trackUserLocation={tracking}
  zoom={FOLLOW_ZOOM}               // ⚠️ 추적 중 줌 고정 방법은 확인 필요
  padding={{ top: 0, right: 0, bottom: bottomInset, left: 0 }}
  onTrackUserLocationChange={(e) => setTracking(e.nativeEvent.trackUserLocation ?? undefined)}
/>
<NativeUserLocation />

// "◎ 내 위치" 버튼
onPress={() => setTracking('heading')}
// 버튼 표시 조건
{!tracking && <Pressable …/>}
```

**실기기 검증 항목**
- 사용자가 지도를 드래그하면 `onTrackUserLocationChange`가 `null`로 오는지 (문서에 명시돼 있지 않음)
- `bottomInset`(하단 패널 높이)이 바뀔 때 padding이 즉시 반영되는지
- 위치 권한 허용 직후, 마지막 위치로 바로 이동하는 기존 동작(`getLastKnownPositionAsync` → `jumpTo`)이 그대로 되는지

---

## 4. 파일별 변경 목록

### 4.1 설정·의존성

| 파일 | 변경 |
|---|---|
| [package.json](../package.json) | `@rnmapbox/maps` 제거, `npx expo install @maplibre/maplibre-react-native` |
| | `@types/geojson` 추가 (devDependency) — 현재 `routeGeoJson.ts`의 전역 `GeoJSON` 타입은 rnmapbox가 끌어오는 타입에 기대고 있을 가능성이 큼. 제거 후 `tsc`로 확인 |
| [app.json](../app.json) | `plugins`의 `"@rnmapbox/maps"` → `"@maplibre/maplibre-react-native"` |
| [.env.example](../.env.example) | `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` 설명 삭제. 유료 제공자를 쓴다면 `EXPO_PUBLIC_MAP_STYLE_URL`(키 포함)로 대체 |
| EAS 환경 변수 | Mapbox 토큰 변수 삭제 |
| `android/` | CNG로 생성되는 폴더이므로 직접 수정하지 않음. 플러그인 교체 후 `npx expo prebuild --clean` (= `npm run prebuild`) |

### 4.2 소스 코드

| 파일 | 변경 내용 | 난이도 |
|---|---|---|
| [src/config/env.ts](../src/config/env.ts) | 토큰 상수 → `MAP_STYLE_URL` 상수(기본값 OpenFreeMap). `hasMapboxToken` 삭제 | 하 |
| [src/features/map/mapbox.ts](../src/features/map/mapbox.ts) | `mapStyle.ts`로 이름 변경. `ensureMapboxInitialized()` 삭제, 스타일 URL만 export | 하 |
| [src/features/map/MissingTokenNotice.tsx](../src/features/map/MissingTokenNotice.tsx) | 삭제. 필요하면 "지도를 불러오지 못했습니다(네트워크)" 안내로 대체 (`onDidFailLoadingMap` 계열 이벤트) | 하 |
| [src/features/map/RouteMap.tsx](../src/features/map/RouteMap.tsx) | 컴포넌트·prop 이름 교체, `bounds` 객체(`ne`/`sw`) → `[w, s, e, n]` 배열 변환 | 중 |
| [src/features/map/WalkMap.tsx](../src/features/map/WalkMap.tsx) | 3.3의 따라가기 로직 재작성, puck 교체, 레이어 문법 교체 | **상** |
| [src/features/map/routeGeoJson.ts](../src/features/map/routeGeoJson.ts) | 변경 없음 (순수 GeoJSON. `[경도, 위도]` 순서도 동일) | — |
| [src/lib/geo.ts](../src/lib/geo.ts#L27) `boundsOf` | 현재 Mapbox 형태 `{ ne, sw }`를 반환함 → `[sw[0], sw[1], ne[0], ne[1]]` 배열로 바꾸는 변환 추가 (또는 반환 형태 자체를 변경. 이 경우 테스트도 수정) | 하 |
| [src/app/index.tsx](../src/app/index.tsx), [src/app/history/[id].tsx](../src/app/history/[id].tsx) | 변경 없음 (`WalkMap`/`RouteMap` props 유지) | — |
| (신규) 보행로 강조 레이어 | 5장 참고 | 중 |

`WalkMap`과 `RouteMap`의 **props를 그대로 두면 화면(`src/app`) 코드는 손대지 않아도 됩니다.** 지도 라이브러리 의존성이 `src/features/map/` 안에만 있도록 설계해 둔 덕분입니다.

### 4.3 테스트

- [routeGeoJson.test.ts](../src/features/map/__tests__/routeGeoJson.test.ts): 순수 함수라 영향 없음
- jest에 rnmapbox 목(mock)이 따로 없으므로 테스트 설정 변경은 없음

### 4.4 문서

| 파일 | 변경 |
|---|---|
| [README.md](../README.md) | 기술 스택 표, "Mapbox 계정/토큰 준비" 절, `.env.local` 안내 |
| [code-flow.md](code-flow.md) | "Mapbox는 그리기만" 같은 문구, `src/features/map/` 설명, 카메라 비교 표(`Viewport followPuck`), 스타일 변경 위치 |
| [walking-tracker-analysis.md](walking-tracker-analysis.md) | 3.2 지도 절, 토큰·과금 절 (이력 보존 차원에서 "→ OSM 전환, osm-migration-analysis.md 참고" 메모만 추가해도 됨) |

---

## 5. 보행로 강조 레이어

OpenFreeMap 스타일은 OpenMapTiles 스키마를 씁니다. 소스 이름은 스타일 JSON에서 확인해야 하며, 보통 `openmaptiles`입니다. 보행로는 `transportation` 레이어의 `class = "path"`에 들어 있습니다.

```tsx
<Layer
  id="walkways-highlight"
  type="line"
  source="openmaptiles"          // ⚠️ liberty 스타일 JSON의 실제 source id 확인
  sourceLayer="transportation"   // ⚠️ prop 이름 확인 (sourceLayerID → ?)
  minzoom={15}
  filter={['==', ['get', 'class'], 'path']}
  paint={{ 'line-color': '#9a7b4f', 'line-width': 2, 'line-dasharray': [1, 1] }}
  beforeId="live-route-line"     // 내 경로 선보다 아래에 깔리도록
/>
```

다른 방법으로, `liberty` 스타일 JSON을 내려받아 [Maputnik](https://maputnik.github.io/)에서 보행로 레이어를 진하게 고친 뒤 **앱에 번들(`mapStyle`에 객체 전달)하거나 직접 호스팅**하는 방식도 있습니다. 앱 업데이트 없이 스타일을 바꾸고 싶다면 호스팅 방식이 낫습니다.

---

## 6. 저작자 표시(라이선스) — 필수

| 출처 | 표시 문구 |
|---|---|
| OpenStreetMap 데이터 (ODbL) | © OpenStreetMap contributors |
| OpenMapTiles 스키마 | © OpenMapTiles |
| OpenFreeMap | 선택 (권장) |

- MapLibre는 스타일에 들어 있는 attribution을 자동으로 보여 줍니다. **하단 패널이나 버튼에 가려지지 않게** 위치를 정해야 합니다. 현재 WalkMap은 상단 왼쪽(`top: 8`)에 두고 있어 그대로 유지하면 됩니다.
- 래스터 OSM 타일을 쓸 때는 앱 이름이 들어간 User-Agent를 설정해야 합니다 (MapLibre `TransformRequestManager` / `NetworkManager`).

---

## 7. 작업 순서 (제안)

1. **데이터 확인** (1.2): 걷는 지역에 OSM 인도 선이 있는지 openstreetmap.org에서 확인. 없으면 여기서 중단하고 국내 SDK를 검토
2. **브랜치 생성**: `feat/maplibre-osm`
3. **의존성·플러그인 교체**: `npx expo install @maplibre/maplibre-react-native`, `@rnmapbox/maps` 제거, app.json 수정, `npx expo-doctor`
4. **RouteMap 먼저 전환** (정적 지도라 쉬움) → 기록 상세 화면에서 확인
5. **WalkMap 전환** (따라가기·puck)
6. **보행로 강조 레이어** 추가, 줌 15~18에서 실기기로 확인
7. **토큰 관련 코드·문서 정리**
8. `npx expo lint`, `npx tsc --noEmit`, `npm test`
9. **새 dev 빌드** (`npx eas-cli@latest build --profile development`): 네이티브 모듈이 바뀌므로 기존 dev 빌드로는 실행되지 않음
10. **실기기 회귀 테스트**: 따라가기 / 지도 드래그 후 "내 위치" 복귀 / 화면 꺼짐 후 복귀 / 기록 상세 경로 맞춤 / 저작자 표시 위치

---

## 8. 리스크 정리

| 리스크 | 영향 | 대응 |
|---|---|---|
| 인도 데이터가 OSM에 없음 | 전환의 원래 목적을 달성하지 못함 | 1단계에서 먼저 확인 |
| OpenFreeMap 장애 (SLA 없음) | 지도 공백 (위치 기록은 계속 동작) | 스타일 URL을 설정값으로 분리해 두고, 문제가 생기면 MapTiler 등으로 교체 |
| Viewport → Camera 추적 전환 시 동작 차이 | "내 위치" 버튼 UX가 달라짐 | 3.3의 실기기 검증 항목 |
| 한국어 지명 표시 | 스타일에 따라 라틴 표기가 섞일 수 있음 | 스타일의 `text-field`를 `name:ko` → `name` 순으로 지정 (Maputnik에서 수정) |
| MapLibre v11은 New Architecture 전용 | 구 아키텍처로 되돌리기 불가 | 현재 RN 0.88이라 해당 없음 |

---

## 참고 자료

- MapLibre React Native: https://maplibre.org/maplibre-react-native/
  - Expo 설정: https://maplibre.org/maplibre-react-native/docs/setup/expo
  - Camera: https://maplibre.org/maplibre-react-native/docs/components/camera
  - CHANGELOG (v11 변경 사항): https://github.com/maplibre/maplibre-react-native/blob/main/CHANGELOG.md
- OpenFreeMap: https://openfreemap.org/ · 빠른 시작: https://openfreemap.org/quick_start/
- OSMF 타일 사용 정책: https://operations.osmfoundation.org/policies/tiles/
- OpenMapTiles 스키마: https://openmaptiles.org/schema/
