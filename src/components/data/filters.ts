import type { EditingDomainsResponse, FeatureKind, FeatureTable, ProjectStatusOption } from '@ugrc/wri-shared/types';

const DEFAULT_PROJECT_STATUSES = new Set(['Proposed', 'Current', 'Pending Completed', 'Completed']);
const alphabeticalSort = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const featureKindByTable: Record<FeatureTable, FeatureKind> = {
  POLY: 'poly',
  LINE: 'line',
  POINT: 'point',
};

export type ProjectStatuses = ProjectStatusOption & {
  default: boolean;
};

export type FeatureType = {
  featureType: string;
  kind: FeatureKind;
};

export type FilterOptions = {
  projectStatus: ProjectStatuses[];
  featureTypes: FeatureType[];
};

export const normalizeProjectStatuses = (projectStatuses: ProjectStatusOption[]): ProjectStatuses[] => {
  return projectStatuses.map((status) => ({
    ...status,
    default: DEFAULT_PROJECT_STATUSES.has(status.value),
  }));
};

export const normalizeFeatureTypes = (featureTypes: EditingDomainsResponse['featureTypes']): FeatureType[] => {
  return Object.entries(featureTypes)
    .map(([featureType, table]) => ({
      featureType,
      kind: featureKindByTable[table],
    }))
    .sort((left, right) => alphabeticalSort.compare(left.featureType, right.featureType));
};

export const normalizeFilterOptions = (domains: EditingDomainsResponse): FilterOptions => ({
  projectStatus: normalizeProjectStatuses(domains.projectStatuses),
  featureTypes: normalizeFeatureTypes(domains.featureTypes),
});

export const getDefaultProjectState = (projectStatuses: ProjectStatuses[]) => {
  return new Set(projectStatuses.filter((status) => status.default).map(({ value }) => value));
};

export const getDefaultFeatureState = (featureTypes: FeatureType[]) => {
  return new Set(featureTypes.map(({ featureType }) => featureType));
};
