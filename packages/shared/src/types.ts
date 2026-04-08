export type FeatureKind = 'poly' | 'line' | 'point';

export type FeatureTable = 'POLY' | 'LINE' | 'POINT';

export type PolyFeatureAttributes = Record<string, string[]>;

export type EditingDomainsResponse = {
  featureTypes: Record<string, FeatureTable>;
  featureAttributes: Record<string, PolyFeatureAttributes | string[]>;
  herbicides: string[];
  pointLineActions: string[];
};

export type PolyTreatment = {
  treatment: string;
  herbicides: string[];
};

export type PolyAction = {
  action: string;
  treatments: PolyTreatment[];
};

export type PointLineAction = {
  type: string;
  action: string;
  description: string;
};

export type FormPolyTreatment = PolyTreatment;

export type FormPolyAction = PolyAction;

export type FormPointLineAction = PointLineAction;

export type CreateFeatureData = {
  projectId: number;
  featureType: string;
  geometry: object | object[];
  retreatment: boolean;
  actions: FormPolyAction[] | FormPointLineAction[] | null;
};

export type CreateFeatureRequest = {
  projectId?: number;
  featureType?: string;
  key?: string | null;
  token?: string | null;
  retreatment?: boolean | null;
  actions?: PolyAction[] | PointLineAction[] | null;
  geometry?: object | object[] | null;
};

export type RetreatmentValue = 'Y' | 'N';

export type CallableCredentials = {
  key?: string | null;
  token?: string | null;
};

export type ProjectRequest = CallableCredentials & {
  id: number;
};

export type FeatureRequest = {
  featureId: number;
  type: string;
};

export type DeleteFeatureRequest = CallableCredentials & {
  projectId: number;
  featureId: number;
  featureType: string;
};

export type MessageResponse = {
  message: string;
};

export type DeleteFeatureResponse = MessageResponse;

export type UpdateProjectStatsRequest = CallableCredentials & {
  projectId: number;
};

export type UpdateProjectStatsResponse = MessageResponse;

export type CreateFeatureResponse = MessageResponse & {
  featureId: number;
  statusDescription: string | null;
};

export type FeatureIntersection = {
  name: string;
  area: string;
};

export type LandOwnerIntersection = {
  owner: string;
  admin: string;
  area: string;
};

export type FeatureLayerId = 'feature-point' | 'feature-line' | 'feature-poly';

export type Feature = {
  id: number;
  type: string;
  subtype: string | null | undefined;
  action: string | null | undefined;
  description: string | null | undefined;
  size: string;
  layer: FeatureLayerId;
};

export type PolygonFeature = {
  id: number;
  type: string;
  subtype: string | null | undefined;
  action: string | null | undefined;
  description?: string | null | undefined;
  herbicides: string[];
  retreatment: boolean | null | undefined;
  size: string;
  layer: FeatureLayerId;
};

export type PolygonFeatures = Record<string, PolygonFeature[]>;

export type ProjectFeatures = {
  polygons: PolygonFeatures;
  lines: Feature[];
  points: Feature[];
};

export type ProjectResponse = ProjectFeatures & {
  allowEdits: boolean;
  county: FeatureIntersection[];
  owner: LandOwnerIntersection[];
  sgma: FeatureIntersection[];
  id: number;
  manager: string;
  agency: string;
  title: string;
  status: string;
  description: string;
  region: string;
  affected: string | null;
  terrestrial: string | null;
  aquatic: string | null;
  easement: string | null;
  stream: string | null;
};

export type FeatureIntersections = {
  county: FeatureIntersection[];
  owner: LandOwnerIntersection[];
  sgma: FeatureIntersection[];
  stream: FeatureIntersection[];
};

export type ProjectRollup = Pick<ProjectResponse, 'county' | 'owner' | 'sgma'>;
