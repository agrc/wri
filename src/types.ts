export type FeatureKind = 'poly' | 'line' | 'point';

export type FeatureTable = 'POLY' | 'LINE' | 'POINT';

export type PolyFeatureAttributes = Record<string, string[]>;

export type EditingDomainsResponse = {
  featureTypes: Record<string, FeatureTable>;
  featureAttributes: Record<string, PolyFeatureAttributes | string[]>;
  herbicides: string[];
  pointLineActions: string[];
};

export type FormPolyTreatment = {
  treatment: string;
  herbicide: string | null;
};

export type FormPolyAction = {
  action: string;
  treatments: FormPolyTreatment[];
};

export type FormPointLineAction = {
  type: string;
  action: string;
  description: string;
};

export type CreateFeatureData = {
  projectId: number;
  featureType: string;
  geometry: object;
  retreatment: boolean;
  actions: FormPolyAction[] | FormPointLineAction[] | null;
};
