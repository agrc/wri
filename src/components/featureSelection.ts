import type { Feature, FeatureKind, PolygonFeature, PolygonFeatures } from '@ugrc/wri-shared/types';

export type SelectedFeature = (Feature | PolygonFeature) & {
  kind: FeatureKind;
  details?: string[];
  isRetreatment?: boolean;
};

export type FeatureSelectionIdentity = {
  projectId: number;
  kind: FeatureKind;
  id: number;
};

const FEATURE_KEY_SEPARATOR = '|';
const baseLayerIdByKind: Record<FeatureKind, string> = {
  poly: 'feature-poly',
  line: 'feature-line',
  point: 'feature-point',
} as const;

export const serializeFeatureKey = (kind: FeatureKind, id: number): string => {
  return `${kind}${FEATURE_KEY_SEPARATOR}${id}`;
};

export const parseFeatureKey = (key?: string | number | null): { kind: FeatureKind; id: number } | undefined => {
  if (key == null) {
    return undefined;
  }

  const raw = typeof key === 'string' ? key : String(key);
  const [kind, idPart] = raw.split(FEATURE_KEY_SEPARATOR);
  const id = Number(idPart);

  if (!kind || Number.isNaN(id) || !(kind === 'poly' || kind === 'line' || kind === 'point')) {
    return undefined;
  }

  return { kind: kind as FeatureKind, id };
};

export const getProjectFeatureLayerId = (projectId: number, kind: FeatureKind) => {
  return `project-${projectId}-${baseLayerIdByKind[kind]}`;
};

export const getFeatureKindFromLayerId = (layerId?: string | null): FeatureKind | undefined => {
  if (!layerId) {
    return undefined;
  }

  if (layerId.endsWith('feature-poly')) {
    return 'poly';
  }

  if (layerId.endsWith('feature-line')) {
    return 'line';
  }

  if (layerId.endsWith('feature-point')) {
    return 'point';
  }

  return undefined;
};

type EnrichFeatureParams =
  | { kind: 'poly'; feature: PolygonFeature; polyGroup: PolygonFeature[] }
  | { kind: 'line'; feature: Feature }
  | { kind: 'point'; feature: Feature };

export const formatPolygonFeatureDetail = (feature: Pick<PolygonFeature, 'action' | 'subtype' | 'herbicides'>) => {
  const herbicideLabel = feature.herbicides.filter(Boolean).join(', ');

  return [feature.action, feature.subtype, herbicideLabel].filter(Boolean).join(' - ');
};

export const enrichFeature = (params: EnrichFeatureParams): SelectedFeature => {
  const { kind } = params;

  if (kind === 'poly') {
    const { feature, polyGroup } = params;
    const polyDetails = polyGroup?.map((pt) => formatPolygonFeatureDetail(pt)).filter((line) => line.length > 0) ?? [];
    const isRetreatment = feature.retreatment === true;

    return {
      ...feature,
      kind,
      details: polyDetails,
      isRetreatment,
    };
  }

  if (kind === 'line') {
    const { feature } = params;
    const lineDetails = [feature.action, feature.subtype].filter(Boolean).join(' - ');

    return {
      ...feature,
      kind,
      details: lineDetails ? [lineDetails] : [],
    };
  }

  const { feature } = params;
  const pointDetails = [feature.action, feature.subtype].filter(Boolean).join(' - ');

  return {
    ...feature,
    kind,
    details: pointDetails ? [pointDetails] : [],
  };
};

type ResolveSelectedFeatureParams = {
  kind: FeatureKind;
  id: number;
  polygons: PolygonFeatures;
  lines: Feature[];
  points: Feature[];
};

export const resolveSelectedFeature = ({ kind, id, polygons, lines, points }: ResolveSelectedFeatureParams) => {
  if (kind === 'poly') {
    const polyGroup = Object.values(polygons).find((group) => group[0]?.id === id);
    const feature = polyGroup?.[0];

    if (!feature || !polyGroup) {
      return null;
    }

    return enrichFeature({ kind: 'poly', feature, polyGroup });
  }

  if (kind === 'line') {
    const feature = lines.find((candidate) => candidate.id === id);

    return feature ? enrichFeature({ kind: 'line', feature }) : null;
  }

  const feature = points.find((candidate) => candidate.id === id);

  return feature ? enrichFeature({ kind: 'point', feature }) : null;
};
