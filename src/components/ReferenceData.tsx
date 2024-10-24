import { Switch, Tag, TagGroup } from '@ugrc/utah-design-system';
import { PaletteIcon } from 'lucide-react';
import { ReactNode, useCallback } from 'react';
import type { Selection } from 'react-aria-components';
import { isVisible } from './utils';

type Layer = __esri.Layer & __esri.ScaleRangeLayer;
export type ReferenceLayer = Layer & {
  hasLegend?: boolean;
};

export const ReferenceData = ({
  layers,
  currentMapScale,
  color = 'secondary',
}: {
  layers: __esri.Collection<ReferenceLayer>;
  currentMapScale: number;
  color?: 'gray' | 'primary' | 'secondary' | 'accent';
}) => {
  return (
    <TagGroup selectionMode="multiple" color={color}>
      {layers
        .filter((x) => x.id.startsWith('reference'))
        .map((layer) => (
          <Tag
            key={layer.id}
            isDisabled={!isVisible(currentMapScale, layer.minScale, layer.maxScale)}
            textValue={layer.title}
          >
            {layer.title}
            {layer.hasLegend && <PaletteIcon className="size-3" />}
          </Tag>
        ))}
    </TagGroup>
  );
};

export const LabelSwitch = ({
  layers,
  children,
}: {
  layers: __esri.Collection<__esri.FeatureLayerProperties>;
  children: ReactNode;
}) => {
  const toggleLabelVisibility = useCallback(
    (isSelected: boolean) => {
      layers.forEach((layer) => {
        layer.labelsVisible = isSelected;
      });
    },
    [layers],
  );

  return <Switch onChange={toggleLabelVisibility}>{children}</Switch>;
};
