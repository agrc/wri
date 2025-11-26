import Collection from '@arcgis/core/core/Collection';
import { Button, Popover, Slider, Tooltip } from '@ugrc/utah-design-system';
import { BlendIcon } from 'lucide-react';
import { useState } from 'react';
import { DialogTrigger, TooltipTrigger } from 'react-aria-components';

const updateOpacity = async (
  layer: __esri.FeatureLayer | __esri.Collection<__esri.FeatureLayer> | null,
  value: number,
  id?: number,
) => {
  if (!layer) {
    return;
  }

  // multiple layers
  if (layer instanceof Collection) {
    layer.forEach((lyr) => {
      lyr.opacity = value / 100;
    });

    return;
  }

  // single layer, no specific feature
  if (!id) {
    layer.opacity = value / 100;

    return;
  }

  // specific feature
  const results = await layer.queryFeatures({
    where: `FeatureID=${id}`,
    outFields: ['FeatureID', '_opacity'],
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

const DEFAULT_POLY_OPACITY = 70;

type OpacityManagerProps =
  | {
      layer: __esri.FeatureLayer;
      oid?: number;
      disabled?: boolean;
    }
  | {
      layers: __esri.Collection<__esri.FeatureLayer> | null;
      disabled?: boolean;
    };

export const OpacityManager = (props: OpacityManagerProps) => {
  let defaultValue = 100;
  let layerOrLayers;

  if ('layer' in props) {
    defaultValue = props?.layer?.id?.includes('poly') ? DEFAULT_POLY_OPACITY : defaultValue;
    layerOrLayers = props.layer;
  } else {
    layerOrLayers = props.layers;
  }

  const [value, setValue] = useState(defaultValue);

  return (
    <DialogTrigger>
      <div>
        <TooltipTrigger>
          <Button isDisabled={props.disabled} variant="icon" className="h-8 min-w-8 rounded border border-zinc-400">
            <BlendIcon className="size-5" />
          </Button>
          <Tooltip>Adjust Feature Opacity</Tooltip>
        </TooltipTrigger>
      </div>
      <Popover placement="right bottom" className="w-44 px-4 py-2">
        <Slider
          label="Feature opacity"
          value={value}
          defaultValue={defaultValue}
          onChange={(value) => {
            setValue(value);
            updateOpacity(layerOrLayers, value, 'oid' in props ? props.oid : undefined);
          }}
        />
      </Popover>
    </DialogTrigger>
  );
};
