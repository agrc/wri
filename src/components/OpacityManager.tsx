import type Collection from '@arcgis/core/core/Collection';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { Button } from '@ugrc/utah-design-system/src/components/Button';
import { Popover } from '@ugrc/utah-design-system/src/components/Popover';
import { Slider } from '@ugrc/utah-design-system/src/components/Slider';
import { Tooltip } from '@ugrc/utah-design-system/src/components/Tooltip';
import { BlendIcon } from 'lucide-react';
import { useState } from 'react';
import { DialogTrigger, TooltipTrigger } from 'react-aria-components';
import { updateOpacity } from './updateOpacity';

const DEFAULT_POLY_OPACITY = 70;

type OpacityManagerProps =
  | {
      layer: FeatureLayer;
      oid?: number;
      disabled?: boolean;
    }
  | {
      layers: Collection<FeatureLayer> | null;
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
