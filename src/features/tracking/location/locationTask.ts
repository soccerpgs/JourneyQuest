import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { enqueueLocations } from '../pipeline';
import { LOCATION_TASK_NAME, toRawLocation } from './expoLocationProvider';

/**
 * 백그라운드 위치 태스크 정의.
 * ⚠️ 반드시 앱 진입 시 모듈 최상위에서 실행되어야 한다 → src/app/_layout.tsx 에서 import.
 */
TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[locationTask]', error.message);
    return;
  }
  const locations = data?.locations ?? [];
  if (locations.length > 0) {
    await enqueueLocations(locations.map(toRawLocation));
  }
});
