import { describe, expect, it } from 'vitest';
import {
  ADJACENT_PROJECT_FEATURE_LAYER_IDS,
  getCurrentProjectFeatureLayerIds,
  getEffectiveAdjacentSnappingEnabled,
  getFeatureGeometrySnappingLayerIds,
} from './featureGeometrySnapping';

describe('featureGeometrySnapping helpers', () => {
  it('builds current-project feature layer ids', () => {
    expect(getCurrentProjectFeatureLayerIds(123)).toEqual([
      'project-123-feature-poly',
      'project-123-feature-line',
      'project-123-feature-point',
    ]);
  });

  it('only enables adjacent snapping when adjacent layers are visible', () => {
    expect(
      getEffectiveAdjacentSnappingEnabled({
        adjacentSnappingEnabled: true,
        adjacentProjectsVisible: true,
      }),
    ).toBe(true);

    expect(
      getEffectiveAdjacentSnappingEnabled({
        adjacentSnappingEnabled: true,
        adjacentProjectsVisible: false,
      }),
    ).toBe(false);
  });

  it('returns only current-project layers when project snapping is enabled', () => {
    expect(
      getFeatureGeometrySnappingLayerIds({
        projectId: 88,
        projectSnappingEnabled: true,
        adjacentSnappingEnabled: false,
        adjacentProjectsVisible: false,
      }),
    ).toEqual(['project-88-feature-poly', 'project-88-feature-line', 'project-88-feature-point']);
  });

  it('returns only adjacent layers when adjacent snapping is enabled and visible', () => {
    expect(
      getFeatureGeometrySnappingLayerIds({
        projectId: 88,
        projectSnappingEnabled: false,
        adjacentSnappingEnabled: true,
        adjacentProjectsVisible: true,
      }),
    ).toEqual(ADJACENT_PROJECT_FEATURE_LAYER_IDS);
  });

  it('returns both current-project and adjacent layers when both snapping modes are active', () => {
    expect(
      getFeatureGeometrySnappingLayerIds({
        projectId: 88,
        projectSnappingEnabled: true,
        adjacentSnappingEnabled: true,
        adjacentProjectsVisible: true,
      }),
    ).toEqual([
      'project-88-feature-poly',
      'project-88-feature-line',
      'project-88-feature-point',
      'feature-poly',
      'feature-line',
      'feature-point',
    ]);
  });

  it('does not return project layers when the project id is missing', () => {
    expect(
      getFeatureGeometrySnappingLayerIds({
        projectId: 0,
        projectSnappingEnabled: true,
        adjacentSnappingEnabled: false,
        adjacentProjectsVisible: false,
      }),
    ).toEqual([]);
  });
});
