/** Mapbox public token. .env.local 의 EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN 에서 읽는다. */
export const MAPBOX_ACCESS_TOKEN: string | undefined =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || undefined;

export const hasMapboxToken = !!MAPBOX_ACCESS_TOKEN && MAPBOX_ACCESS_TOKEN.startsWith('pk.');
