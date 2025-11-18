import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import ProjectFeaturesList, { type FeatureDetails } from './ProjectFeaturesList';

import type { Feature, PolygonFeatures } from './ProjectSpecific';

const meta = {
  title: 'Components/ProjectFeaturesList',
  component: ProjectFeaturesList,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ProjectFeaturesList>;

export default meta;
type Story = StoryObj<typeof meta>;

const samplePolygons: PolygonFeatures = {
  groupA: [
    {
      id: 101,
      type: 'Terrestrial',
      subtype: 'Road decommissioning',
      action: 'Prescribed Fire',
      herbicide: '',
      retreatment: 'N',
      layer: 'feature-poly',
      size: '12 ac',
      description: 'A sample polygon feature',
    },
    {
      id: 101,
      type: 'Polygon A',
      subtype: 'subtype 2',
      action: 'action 2',
      herbicide: 'Agrispread',
      retreatment: 'Y',
      layer: 'feature-poly',
      size: '12 ac',
      description: 'A sample polygon feature',
    },
  ],
};

const sampleLines: Feature[] = [
  {
    id: 201,
    type: 'Pipeline',
    subtype: null,
    action: 'Construction',
    layer: 'feature-line',
    size: '2 mi',
    description: '',
  },
  {
    id: 202,
    type: 'Fence',
    subtype: 'Below surface',
    action: 'action',
    layer: 'feature-line',
    size: '2 mi',
    description: 'A sample line feature',
  },
];

const samplePoints: Feature[] = [
  {
    id: 301,
    type: 'Other Point',
    action: null,
    subtype: null,
    description: 'desc',
    layer: 'feature-point',
    size: '1',
  },
];

export const Default: Story = {
  args: {
    projectId: 1,
    polygons: samplePolygons,
    lines: sampleLines,
    points: samplePoints,
    onSelect: () => true,
  },
  render: (args) => {
    type WrapperArgs = {
      projectId: number;
      polygons: PolygonFeatures;
      lines: Feature[];
      points: Feature[];
      onSelect?: (details: FeatureDetails) => boolean;
    };

    function StoryWrapper(wrapperArgs: WrapperArgs) {
      const [active, setActive] = useState<FeatureDetails | null>(null);

      function handleSelect(details: FeatureDetails) {
        const same = active && active.layer === details.layer && active.id === details.id;
        if (same) {
          setActive(null);
          return false;
        }
        setActive(details);
        return true;
      }

      return (
        <div className="w-96 dark:bg-zinc-800">
          <ProjectFeaturesList
            projectId={wrapperArgs.projectId}
            polygons={wrapperArgs.polygons}
            lines={wrapperArgs.lines}
            points={wrapperArgs.points}
            onSelect={handleSelect}
            onClear={() => setActive(null)}
          />
          <pre className="mt-4">Active: {active ? `${active.layer} ${active.id}` : 'none'}</pre>
        </div>
      );
    }

    return <StoryWrapper {...(args as unknown as WrapperArgs)} />;
  },
};
