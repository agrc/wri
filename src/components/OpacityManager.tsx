import { Button, Popover, Slider } from '@ugrc/utah-design-system';
import { BlendIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DialogTrigger } from 'react-aria-components';

import type { Line, Point, Polygon } from './ProjectSpecific';

const updateOpacity = async (layer: __esri.FeatureLayer | null, id: number, value: number) => {
  if (!layer || id === -1) {
    return;
  }

  const results = await layer.queryFeatures({
    where: `FeatureID=${id}`,
    outFields: ['FeatureID', '_opacity', 'ESRI_OID'],
    returnGeometry: false,
  });

  if (results.features.length === 0) {
    return;
  }

  layer
    .applyEdits({
      updateFeatures: results.features.map((feature) => {
        feature.attributes._opacity = value / 100;
        return feature;
      }),
    })
    .catch((error) => {
      console.error('Failed to set opacity:', error);
    });
};

export const OpacityManager = ({
  feature,
  layers,
  currentProject,
}: {
  feature?: Polygon | Line | Point;
  layers: __esri.Collection<__esri.FeatureLayer>;
  currentProject: number;
}) => {
  const layer = useRef<__esri.FeatureLayer | null>(null);

  useEffect(() => {
    if (!feature) {
      return;
    }

    const managedLayer = layers.find((x) => x.id === `project-${currentProject}-` + feature.layer);

    if (!managedLayer) {
      return;
    }

    layer.current = managedLayer;
  }, [currentProject, feature, layers]);

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
          defaultValue={feature?.layer.includes('poly') ? 70 : 100}
          onChange={(value) => updateOpacity(layer.current, feature?.id ?? -1, value)}
        />
      </Popover>
    </DialogTrigger>
  );
};
