import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { renderPreviewHTML } from '@arcgis/core/symbols/support/symbolUtils';
import { Button, Dialog, Popover, Switch, Tag, TagGroup } from '@ugrc/utah-design-system';
import { PaletteIcon } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { DialogTrigger, type Selection } from 'react-aria-components';
import config from '../config';
import { isVisible } from './utils';

export type ReferenceLayer = __esri.Layer & __esri.ScaleRangeLayer;
export type ReferenceLayerWithMetadata = ReferenceLayer & { legendDescription?: string };

export const ReferenceData = ({
  layers,
  currentMapScale,
  color = 'gray',
}: {
  layers: __esri.Collection<ReferenceLayer>;
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
            textValue={layer.title}
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

const Swatch = ({ symbol }: { symbol: __esri.Symbol }) => {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    renderPreviewHTML(symbol).then((node) => {
      if (!divRef.current) {
        return;
      }

      divRef.current.innerHTML = '';
      divRef.current.append(node);
    });
  }, [symbol]);

  return <div className="size-6 content-center" ref={divRef}></div>;
};

const SwatchWithLabel = ({ symbol, label }: { symbol: __esri.Symbol; label: string }) => {
  return (
    <div className="flex items-end space-x-2" key={label}>
      <Swatch symbol={symbol} />
      <span className="text-sm">{label}</span>
    </div>
  );
};

const UniqueValueSwatches = ({ groups }: { groups: __esri.UniqueValueGroup[] }) => {
  return (
    <>
      {groups.map(({ heading, classes }) => (
        <div key={heading}>
          {classes.map(({ label, symbol }) => (
            <SwatchWithLabel symbol={symbol} label={label} key={label} />
          ))}
        </div>
      ))}
    </>
  );
};

const ClassBreakSwatches = ({ infos }: { infos: __esri.ClassBreakInfo[] }) => {
  return (
    <>
      {infos.map(({ label, symbol }) => (
        <SwatchWithLabel symbol={symbol} label={label} key={label} />
      ))}
    </>
  );
};

const Swatches = ({ renderer }: { renderer: __esri.Renderer }) => {
  switch (renderer.type) {
    case 'simple': {
      return <Swatch symbol={(renderer as __esri.SimpleRenderer).symbol} />;
    }
    case 'unique-value': {
      const uniqueValueRenderer = renderer as __esri.UniqueValueRenderer;

      return <UniqueValueSwatches groups={uniqueValueRenderer.uniqueValueGroups} />;
    }
    case 'class-breaks': {
      const classBreaksRenderer = renderer as __esri.ClassBreaksRenderer;

      return <ClassBreakSwatches infos={classBreaksRenderer.classBreakInfos} />;
    }
    default:
      throw new Error(`Unknown renderer type: ${renderer.type}`);
  }
};

export const ReferenceDataLegend = ({ layer }: { layer: ReferenceLayerWithMetadata }) => {
  let renderer: __esri.Renderer | undefined;
  let fields: __esri.Field[] | undefined;

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
      <Button variant="icon" aria-label="Help" slot="remove">
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
