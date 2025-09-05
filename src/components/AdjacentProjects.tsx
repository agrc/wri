import { Switch } from '@ugrc/utah-design-system';
import { useRef, useState } from 'react';
import { OpacityManager } from './OpacityManager';

type AdjacentProjectsProps = {
  mapView: __esri.MapView | null;
};

export function AdjacentProjects({ mapView }: AdjacentProjectsProps) {
  const [on, setOn] = useState(false);
  const layers = useRef<__esri.Collection<__esri.Layer> | null>(null);

  useState(() => {
    if (!mapView?.map) return;

    layers.current = mapView.map.layers.filter((layer) => layer.id.startsWith('feature-'));
  });

  const toggleFeatureLayers = (selected: boolean) => {
    setOn(selected);
    layers.current?.forEach((layer) => {
      layer.visible = selected;
    });
  };

  return (
    <div className="flex items-center justify-between">
      <Switch onChange={toggleFeatureLayers} isSelected={on}>
        Adjacent Projects
      </Switch>
      {on && <OpacityManager layers={layers.current as __esri.Collection<__esri.FeatureLayer>} />}
    </div>
  );
}
