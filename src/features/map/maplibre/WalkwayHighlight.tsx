import { Layer } from '@maplibre/maplibre-react-native';
import { LIBERTY_PATH_LAYER_ID, OPENMAPTILES_SOURCE_ID } from './styles';

/**
 * OpenMapTiles 스키마의 보행로(transportation 레이어, class = path | pedestrian)를 진하게 덧그린다.
 * liberty 스타일의 기본 보행로(흰 점선) 바로 위에 올린다.
 * OSM에 인도가 별도 선으로 그려져 있지 않은 지역(차도에 sidewalk 속성만 있는 곳)은 그릴 선이 없다.
 */
export function WalkwayHighlight() {
  return (
    <Layer
      id="walkway-highlight"
      type="line"
      source={OPENMAPTILES_SOURCE_ID}
      source-layer="transportation"
      afterId={LIBERTY_PATH_LAYER_ID}
      minzoom={14}
      filter={['match', ['get', 'class'], ['path', 'pedestrian'], true, false]}
      layout={{ 'line-join': 'round', 'line-cap': 'round' }}
      paint={{
        'line-color': '#B45309',
        'line-opacity': 0.85,
        'line-dasharray': [2, 1],
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 17, 2.5, 20, 5],
      }}
    />
  );
}
