import FeatureEffect from '@arcgis/core/layers/support/FeatureEffect.js';
import { Button, Popover, Slider } from '@ugrc/utah-design-system';
import { BlendIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DialogTrigger } from 'react-aria-components';

import type { Line, Point, Polygon } from './ProjectSpecific';

const setOpacity = (layerView: __esri.FeatureLayerView | null, id: number, value: number) => {
  if (!layerView || id === -1) {
    return;
  }

  // only one effect can be in place at a time
  // TODO! move this to a context to manage the where clause
  const effect = new FeatureEffect({
    filter: {
      where: `FeatureID=${id}`,
    },
    includedEffect: `opacity(${value}%)`,
  });

  layerView.featureEffect = effect;
};

export const OpacityManager = ({
  feature,
  layers,
  mapView,
}: {
  feature?: Polygon | Line | Point;
  layers: __esri.Collection<__esri.FeatureLayer>;
  mapView: __esri.MapView;
}) => {
  const layerView = useRef<__esri.FeatureLayerView | null>(null);

  useEffect(() => {
    if (!feature) {
      return;
    }

    const layer = layers.find((x) => x.id === feature.layer);

    mapView.whenLayerView(layer).then((view) => {
      layerView.current = view;
    });
  }, [feature, layers, mapView]);

  return (
    <DialogTrigger>
      <div>
        <Button variant="icon" className="h-8 min-w-8 rounded border border-zinc-400">
          <BlendIcon className="size-5" />
        </Button>
      </div>
      <Popover placement="right bottom" className="w-44 px-4 py-2">
        <Slider
          label="feature opacity"
          defaultValue={70}
          onChange={(value) => setOpacity(layerView.current, feature?.id ?? -1, value)}
        />
      </Popover>
    </DialogTrigger>
  );
};
