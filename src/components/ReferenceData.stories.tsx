import Collection from '@arcgis/core/core/Collection';
import type { FeatureLayerProperties } from '@arcgis/core/layers/FeatureLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { Meta, StoryObj } from '@storybook/react-vite';

import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import { ReferenceData, type ReferenceLayer } from './ReferenceData';
type LegendMetadata = FeatureLayerProperties & {
  legendDescription?: string;
};

const ReferenceDataStory = ({
  currentMapScale,
  color = 'gray',
}: Pick<React.ComponentProps<typeof ReferenceData>, 'currentMapScale' | 'color'>) => {
  return <ReferenceData layers={createLayers()} currentMapScale={currentMapScale} color={color} />;
};

const meta = {
  title: 'Components/ReferenceData',
  component: ReferenceDataStory,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      options: ['gray', 'primary', 'secondary', 'accent'],
      defaultValue: 'gray',
    },
    currentMapScale: {
      defaultValue: 11,
    },
  },
} satisfies Meta<typeof ReferenceDataStory>;

export default meta;
type Story = StoryObj<typeof meta>;

const createLayers = () => {
  const layers = new Collection<ReferenceLayer>();

  layers.addMany([
    new FeatureLayer({
      title: 'Land Ownership',
      url: '',
      id: 'reference-land-ownership',
      legendDescription: 'A legend description',
    } as LegendMetadata),
    new FeatureLayer({
      title: 'Utah PLSS',
      url: '',
      id: 'reference-plss',
    }),
    new FeatureLayer({
      title: 'NHD Streams',
      id: 'reference-streams',
      url: '',
      minScale: 10,
      maxScale: 0,
      renderer: new SimpleRenderer({
        symbol: new SimpleLineSymbol({
          style: 'solid',
          color: [115, 223, 255, 255],
          cap: 'round',
          width: 2,
        }),
      }),
    }),
    new FeatureLayer({
      title: 'HUC 10 Watersheds',
      url: '',
      id: 'reference-watershed-areas',
      minScale: 20,
      maxScale: 0,
      renderer: new SimpleRenderer({
        symbol: new SimpleFillSymbol({
          style: 'none',
          outline: {
            type: 'simple-line',
            style: 'solid',
            width: 3,
          },
        }),
      }),
    }),
    new FeatureLayer({
      title: 'Visible bug',
      id: 'not-a-reference-layer',
    }),
  ]);

  return layers;
};

export const Example: Story = {
  args: {
    currentMapScale: 11,
  },
  render: (args) => <ReferenceDataStory {...args} />,
};
