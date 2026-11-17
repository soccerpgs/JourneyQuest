import Mapbox from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN, hasMapboxToken } from '@/config/env';

let initialized = false;

/** 지도 컴포넌트를 그리기 전에 한 번 호출 */
export function ensureMapboxInitialized(): boolean {
  if (!hasMapboxToken) return false;
  if (!initialized) {
    void Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN!);
    initialized = true;
  }
  return true;
}

export const MAP_STYLE_URL = Mapbox.StyleURL.Outdoors;
