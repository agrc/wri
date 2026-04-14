const FEATURE_GEOMETRY_LAYER_KINDS = ['poly', 'line', 'point'] as const;

export const ADJACENT_PROJECT_FEATURE_LAYER_IDS = FEATURE_GEOMETRY_LAYER_KINDS.map((kind) => `feature-${kind}`);

type FeatureGeometrySnappingOptions = {
  projectId: number;
  projectSnappingEnabled: boolean;
  adjacentSnappingEnabled: boolean;
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
  adjacentProjectsVisible,
}: FeatureGeometrySnappingOptions) => {
  const layerIds: string[] = [];

  if (projectId > 0 && projectSnappingEnabled) {
    layerIds.push(...getCurrentProjectFeatureLayerIds(projectId));
  }

  if (getEffectiveAdjacentSnappingEnabled({ adjacentSnappingEnabled, adjacentProjectsVisible })) {
    layerIds.push(...ADJACENT_PROJECT_FEATURE_LAYER_IDS);
  }

  return layerIds;
};
