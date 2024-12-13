import Collection from '@arcgis/core/core/Collection';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { Meta, StoryObj } from '@storybook/react';

import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import { ReferenceData, type ReferenceLayer } from './ReferenceData';
type LegendMetadata = __esri.FeatureLayerProperties & {
  legendDescription?: string;
};

const meta = {
  title: 'Example/ReferenceData',
  component: ReferenceData,
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
} satisfies Meta<typeof ReferenceData>;

export default meta;
type Story = StoryObj<typeof meta>;

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
    fields: ['name'],
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
    title: 'Watershed Areas',
    url: '',
    fields: ['area'],
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

export const Example: Story = {
  args: {
    layers,
    currentMapScale: 11,
  },
  render: (args) => <ReferenceData {...args} />,
};
