import type { Feature, PolygonFeatures } from '@ugrc/wri-shared/types';
import { describe, expect, it } from 'vitest';
import {
  getFeatureKindFromLayerId,
  getProjectFeatureLayerId,
  parseFeatureKey,
  resolveSelectedFeature,
  serializeFeatureKey,
} from './featureSelection';

const polygons: PolygonFeatures = {
  areaA: [
    {
      id: 10,
      type: 'Terrestrial Treatment Area',
      subtype: 'Mechanical',
      action: 'Thin',
      description: 'Polygon feature',
      size: '11 ac',
      layer: 'feature-poly',
      herbicides: ['Imazapic', 'Glyphosate'],
      retreatment: true,
    },
    {
      id: 10,
      type: 'Terrestrial Treatment Area',
      subtype: 'Seeding',
      action: 'Reseed',
      description: 'Polygon feature',
      size: '11 ac',
      layer: 'feature-poly',
      herbicides: [],
      retreatment: true,
    },
  ],
};

const lines: Feature[] = [
  {
    id: 20,
    type: 'Fence',
    subtype: 'Buck and rail',
    action: 'Repair',
    description: 'Line feature',
    size: '3 mi',
    layer: 'feature-line',
  },
];

const points: Feature[] = [
  {
    id: 30,
    type: 'Guzzler',
    subtype: 'Water',
    action: 'Install',
    description: 'Point feature',
    size: '1 unit',
    layer: 'feature-point',
  },
];

describe('featureSelection helpers', () => {
  it('serializes and parses feature keys', () => {
    const key = serializeFeatureKey('line', 42);

    expect(key).toBe('line|42');
    expect(parseFeatureKey(key)).toEqual({ kind: 'line', id: 42 });
  });

  it('builds and parses project feature layer ids', () => {
    const layerId = getProjectFeatureLayerId(7, 'point');

    expect(layerId).toBe('project-7-feature-point');
    expect(getFeatureKindFromLayerId(layerId)).toBe('point');
    expect(getFeatureKindFromLayerId('reference-land-ownership')).toBeUndefined();
  });

  it('resolves polygon selections with enriched details', () => {
    const selected = resolveSelectedFeature({ kind: 'poly', id: 10, polygons, lines, points });

    expect(selected).toMatchObject({
      id: 10,
      kind: 'poly',
      isRetreatment: true,
      details: ['Thin - Mechanical - Imazapic, Glyphosate', 'Reseed - Seeding'],
    });
  });

  it('returns null when a selected feature cannot be resolved', () => {
    expect(resolveSelectedFeature({ kind: 'point', id: 999, polygons, lines, points })).toBeNull();
  });
});
