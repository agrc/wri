import Collection from '@arcgis/core/core/Collection';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type { Meta, StoryObj } from '@storybook/react';

import { ReferenceData, ReferenceLayer } from './ReferenceData';

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
    },
  },
} satisfies Meta<typeof ReferenceData>;

export default meta;
type Story = StoryObj<typeof meta>;

const layers = new Collection<ReferenceLayer>();
layers.addMany([
  new GraphicsLayer({
    title: 'Land Ownership',
    id: 'reference-land-ownership',
    hasLegend: true,
  } as ReferenceLayer),
  new GraphicsLayer({
    title: 'Utah PLSS',
    id: 'reference-plss',
  }),
  new GraphicsLayer({
    title: 'NHD Streams',
    id: 'reference-streams',
    minScale: 10,
    maxScale: 0,
  }),
  new GraphicsLayer({
    title: 'Watershed Areas',
    id: 'reference-watershed-areas',
    minScale: 20,
    maxScale: 0,
  }),
  new GraphicsLayer({
    title: 'Visible bug',
    id: 'not-a-reference-layer',
  }),
]);

export const Example: Story = {
  args: {
    layers,
    currentMapScale: 11,
  },
};
