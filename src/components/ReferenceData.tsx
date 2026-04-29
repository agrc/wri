import Collection from '@arcgis/core/core/Collection';
import type { FeatureLayerProperties } from '@arcgis/core/layers/FeatureLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Layer from '@arcgis/core/layers/Layer';
import type { ScaleRangeLayer } from '@arcgis/core/layers/mixins/ScaleRangeLayer';
import type Field from '@arcgis/core/layers/support/Field';
import type ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import type SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import type ClassBreakInfo from '@arcgis/core/renderers/support/ClassBreakInfo';
import type UniqueValueGroup from '@arcgis/core/renderers/support/UniqueValueGroup';
import type { RendererUnion } from '@arcgis/core/renderers/types';
import type UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import { renderPreviewHTML } from '@arcgis/core/symbols/support/symbolUtils';
import type { SymbolUnion } from '@arcgis/core/symbols/types';
import { Button } from '@ugrc/utah-design-system/src/components/Button';
import { Dialog } from '@ugrc/utah-design-system/src/components/Dialog';
import { Popover } from '@ugrc/utah-design-system/src/components/Popover';
import { Switch } from '@ugrc/utah-design-system/src/components/Switch';
import { Tag, TagGroup } from '@ugrc/utah-design-system/src/components/TagGroup';
import { PaletteIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { DialogTrigger, type Selection } from 'react-aria-components';
import config from '../config';
import { isVisible } from './utils';

export type ReferenceLayer = Layer & ScaleRangeLayer;
export type ReferenceLayerWithMetadata = ReferenceLayer & { legendDescription?: string };

export const ReferenceData = ({
  layers,
  currentMapScale,
  color = 'gray',
}: {
  layers: Collection<ReferenceLayer>;
  currentMapScale: number;
  color?: 'gray' | 'primary' | 'secondary' | 'accent';
}) => {
  const setLayerVisibility = useCallback(
    (keys: Selection) => {
      layers
        .filter((x) => x.id.startsWith('reference'))
        .forEach((layer) => {
          if (keys === 'all') {
            layer.visible = true;

            return;
          }

          layer.visible = keys.has(layer.id);
        });
    },
    [layers],
  );

  return (
    <TagGroup selectionMode="multiple" color={color} onSelectionChange={setLayerVisibility}>
      {layers
        .filter((x) => (x.id ?? '').startsWith('reference'))
        .map((layer) => (
          <Tag
            id={layer.id}
            key={layer.id}
            isDisabled={!isVisible(currentMapScale, layer.minScale, layer.maxScale)}
            textValue={layer.title ?? 'unknown'}
          >
            {layer.title}
            <ReferenceDataLegend layer={layer} />
          </Tag>
        ))}
    </TagGroup>
  );
};

export const ReferenceLabelSwitch = ({
  layers,
  children,
}: {
  layers: Collection<FeatureLayerProperties>;
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

const Swatch = ({ symbol }: { symbol: SymbolUnion | nullish }) => {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!symbol || !divRef.current) {
      return;
    }

    renderPreviewHTML(symbol).then((node) => {
      if (!divRef.current || !node) {
        return;
      }

      divRef.current.innerHTML = '';
      divRef.current.append(node);
    });
  }, [symbol]);

  return <div className="size-6 content-center" ref={divRef}></div>;
};

const SwatchWithLabel = ({ symbol, label }: { symbol: SymbolUnion | nullish; label: string | nullish }) => {
  return (
    <div className="flex items-end space-x-2" key={label}>
      <Swatch symbol={symbol} />
      <span className="text-sm">{label}</span>
    </div>
  );
};

const UniqueValueSwatches = ({ groups }: { groups: UniqueValueGroup[] | nullish }) => {
  if (!groups) {
    return null;
  }

  return (
    <>
      {groups.map(({ heading, classes }) => (
        <div key={heading}>
          {(classes ?? []).map(({ label, symbol }) => (
            <SwatchWithLabel symbol={symbol} label={label} key={label} />
          ))}
        </div>
      ))}
    </>
  );
};

const ClassBreakSwatches = ({ infos }: { infos: ClassBreakInfo[] }) => {
  return (
    <>
      {infos.map(({ label, symbol }) => (
        <SwatchWithLabel symbol={symbol} label={label} key={label} />
      ))}
    </>
  );
};

const Swatches = ({ renderer }: { renderer: RendererUnion }) => {
  switch (renderer.type) {
    case 'simple': {
      return <Swatch symbol={(renderer as SimpleRenderer).symbol} />;
    }
    case 'unique-value': {
      const uniqueValueRenderer = renderer as UniqueValueRenderer;

      return <UniqueValueSwatches groups={uniqueValueRenderer.uniqueValueGroups} />;
    }
    case 'class-breaks': {
      const classBreaksRenderer = renderer as ClassBreaksRenderer;

      return <ClassBreakSwatches infos={classBreaksRenderer.classBreakInfos} />;
    }
    default:
      throw new Error(`Unknown renderer type: ${renderer.type}`);
  }
};

export const ReferenceDataLegend = ({ layer }: { layer: ReferenceLayerWithMetadata }) => {
  let renderer: RendererUnion | nullish;
  let fields: Field[] | nullish;

  const legendInfo = config.LEGEND_DATA.find((info) => info.id === layer.id);
  if (!legendInfo && layer instanceof FeatureLayer) {
    const featureLayer = layer as FeatureLayer;
    renderer = featureLayer.renderer;
    fields = featureLayer.fields;
  } else if (legendInfo) {
    if (legendInfo.type === 'renderer') {
      renderer = legendInfo.renderer;
      fields = [];
    }
  }

  return (
    <DialogTrigger>
      <Button variant="icon" aria-label="Legend" slot="remove" className="min-h-0 px-0">
        <PaletteIcon className="size-3 has-[data-disabled]:text-red-400 has-[data-selected]:text-white" />
      </Button>
      <Popover className="min-h-20 w-full min-w-0 max-w-[325px]">
        <Dialog className="dark:text-white">
          <p slot="header" className="pb-2 text-sm font-semibold">
            {layer.title} Legend
          </p>
          {layer.legendDescription && (
            <p className="pb-2 text-sm font-semibold italic text-zinc-500">{layer.legendDescription}</p>
          )}
          {renderer && fields && <Swatches renderer={renderer} />}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
