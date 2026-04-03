import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { FeatureSelectionProvider, useFeatureSelection } from './contexts';
import { resolveSelectedFeature } from './featureSelection';
import ProjectFeaturesList from './ProjectFeaturesList';

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
      retreatment: false,
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
      retreatment: true,
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
    allowEdits: false,
    polygons: samplePolygons,
    lines: sampleLines,
    points: samplePoints,
  },
  render: (args) => {
    type WrapperArgs = {
      projectId: number;
      allowEdits: boolean;
      polygons: PolygonFeatures;
      lines: Feature[];
      points: Feature[];
    };

    function SelectionHarness(wrapperArgs: WrapperArgs) {
      const { registerResolver, selectedFeatureKey } = useFeatureSelection();

      useEffect(() => {
        registerResolver((selection) => {
          if (selection.projectId !== wrapperArgs.projectId) {
            return null;
          }

          return resolveSelectedFeature({
            kind: selection.kind,
            id: selection.id,
            polygons: wrapperArgs.polygons,
            lines: wrapperArgs.lines,
            points: wrapperArgs.points,
          });
        });

        return () => {
          registerResolver(null);
        };
      }, [registerResolver, wrapperArgs.lines, wrapperArgs.points, wrapperArgs.polygons, wrapperArgs.projectId]);

      return (
        <div className="w-96 dark:bg-zinc-800">
          <ProjectFeaturesList
            projectId={wrapperArgs.projectId}
            allowEdits={wrapperArgs.allowEdits}
            polygons={wrapperArgs.polygons}
            lines={wrapperArgs.lines}
            points={wrapperArgs.points}
          />
          <pre className="mt-4">Active: {selectedFeatureKey ?? 'none'}</pre>
        </div>
      );
    }

    return (
      <FeatureSelectionProvider>
        <SelectionHarness {...(args as unknown as WrapperArgs)} />
      </FeatureSelectionProvider>
    );
  },
};
