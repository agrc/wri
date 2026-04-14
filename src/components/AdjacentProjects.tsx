import { Switch } from '@ugrc/utah-design-system';
import { useEffect, useRef } from 'react';
import { OpacityManager } from './OpacityManager';

type AdjacentProjectsProps = {
  mapView: __esri.MapView | null;
  isSelected: boolean;
  onChange: (selected: boolean) => void;
};

export function AdjacentProjects({ mapView, isSelected, onChange }: AdjacentProjectsProps) {
  const layers = useRef<__esri.Collection<__esri.Layer> | null>(null);

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
      {mapView?.ready && (
        <OpacityManager disabled={!isSelected} layers={layers.current as __esri.Collection<__esri.FeatureLayer>} />
      )}
    </div>
  );
}
