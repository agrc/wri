import type Collection from '@arcgis/core/core/Collection';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Layer from '@arcgis/core/layers/Layer';
import type MapView from '@arcgis/core/views/MapView';
import { Switch } from '@ugrc/utah-design-system/src/components/Switch';
import { useEffect, useRef } from 'react';
import { OpacityManager } from './OpacityManager';

type AdjacentProjectsProps = {
  mapView: MapView | null;
  isSelected: boolean;
  onChange: (selected: boolean) => void;
};

export function AdjacentProjects({ mapView, isSelected, onChange }: AdjacentProjectsProps) {
  const layers = useRef<Collection<Layer> | null>(null);

  useEffect(() => {
    if (!mapView?.map || !mapView?.ready) {
      return;
    }

    layers.current = mapView.map.layers.filter((layer) => layer.id.startsWith('feature-'));
    layers.current?.forEach((layer) => {
      layer.visible = isSelected;
    });
  }, [isSelected, mapView?.map, mapView?.ready]);

  return (
    <div className="flex items-center justify-between">
      <Switch onChange={onChange} isSelected={isSelected}>
        Adjacent Projects
      </Switch>
      {mapView?.ready && <OpacityManager disabled={!isSelected} layers={layers.current as Collection<FeatureLayer>} />}
    </div>
  );
}
