export const projectStatus = [
  {
    code: 1,
    value: 'Draft',
    default: false,
  },
  {
    code: 2,
    value: 'Proposed',
    default: true,
  },
  {
    code: 3,
    value: 'Current',
    default: true,
  },
  {
    code: 4,
    value: 'Pending Completed',
    default: true,
  },
  {
    code: 5,
    value: 'Completed',
    default: true,
  },
  {
    code: 6,
    value: 'Cancelled',
    default: false,
  },
];
export type ProjectStatuses = (typeof projectStatus)[number];

export type FeatureType = {
  code: number;
  featureType: string;
  type: 'poly' | 'point' | 'line';
};
export const featureTypes = [
  {
    code: 1,
    featureType: 'Terrestrial Treatment Area',
    type: 'poly',
  },
  {
    code: 2,
    featureType: 'Aquatic/Riparian Treatment Area',
    type: 'poly',
  },
  {
    code: 3,
    featureType: 'Affected Area',
    type: 'poly',
  },
  {
    code: 4,
    featureType: 'Easement/Acquisition',
    type: 'poly',
  },
  {
    code: 5,
    featureType: 'Guzzler',
    type: 'point',
  },
  {
    code: 8,
    featureType: 'Other point feature',
    type: 'point',
  },
  {
    code: 9,
    featureType: 'Fish passage structure',
    type: 'point',
  },
  {
    code: 10,
    featureType: 'Fence',
    type: 'line',
  },
  {
    code: 11,
    featureType: 'Pipeline',
    type: 'line',
  },
  {
    code: 12,
    featureType: 'Dam',
    type: 'line',
  },
  {
    code: 13,
    featureType: 'Water development point feature',
    type: 'point',
  },
] as FeatureType[];
