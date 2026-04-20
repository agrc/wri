const FEATURE_GEOMETRY_LAYER_KINDS = ['poly', 'line', 'point'] as const;

export const ADJACENT_PROJECT_FEATURE_LAYER_IDS = FEATURE_GEOMETRY_LAYER_KINDS.map((kind) => `feature-${kind}`);
export const LAND_OWNERSHIP_REFERENCE_LAYER_ID = 'reference-land-ownership';

type FeatureGeometrySnappingOptions = {
  projectId: number;
  projectSnappingEnabled: boolean;
  adjacentSnappingEnabled: boolean;
  landOwnershipSnappingEnabled: boolean;
  adjacentProjectsVisible: boolean;
};

export const getCurrentProjectFeatureLayerIds = (projectId: number) =>
  FEATURE_GEOMETRY_LAYER_KINDS.map((kind) => `project-${projectId}-feature-${kind}`);

export const getEffectiveAdjacentSnappingEnabled = ({
  adjacentSnappingEnabled,
  adjacentProjectsVisible,
}: Pick<FeatureGeometrySnappingOptions, 'adjacentSnappingEnabled' | 'adjacentProjectsVisible'>) =>
  adjacentSnappingEnabled && adjacentProjectsVisible;

export const getFeatureGeometrySnappingLayerIds = ({
  projectId,
  projectSnappingEnabled,
  adjacentSnappingEnabled,
  landOwnershipSnappingEnabled,
  adjacentProjectsVisible,
}: FeatureGeometrySnappingOptions) => {
  const layerIds: string[] = [];

  if (projectId > 0 && projectSnappingEnabled) {
    layerIds.push(...getCurrentProjectFeatureLayerIds(projectId));
  }

  if (getEffectiveAdjacentSnappingEnabled({ adjacentSnappingEnabled, adjacentProjectsVisible })) {
    layerIds.push(...ADJACENT_PROJECT_FEATURE_LAYER_IDS);
  }

  if (landOwnershipSnappingEnabled) {
    layerIds.push(LAND_OWNERSHIP_REFERENCE_LAYER_ID);
  }

  return layerIds;
};
