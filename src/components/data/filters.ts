import type { FeatureKind } from '../../types';

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
  kind: FeatureKind;
};
export const featureTypes = [
  {
    code: 1,
    featureType: 'Terrestrial Treatment Area',
    kind: 'poly',
  },
  {
    code: 2,
    featureType: 'Aquatic/Riparian Treatment Area',
    kind: 'poly',
  },
  {
    code: 3,
    featureType: 'Affected Area',
    kind: 'poly',
  },
  {
    code: 4,
    featureType: 'Easement/Acquisition',
    kind: 'poly',
  },
  {
    code: 5,
    featureType: 'Guzzler',
    kind: 'point',
  },
  {
    code: 8,
    featureType: 'Other point feature',
    kind: 'point',
  },
  {
    code: 9,
    featureType: 'Fish passage structure',
    kind: 'point',
  },
  {
    code: 10,
    featureType: 'Fence',
    kind: 'line',
  },
  {
    code: 11,
    featureType: 'Pipeline',
    kind: 'line',
  },
  {
    code: 12,
    featureType: 'Dam',
    kind: 'line',
  },
  {
    code: 13,
    featureType: 'Water development point feature',
    kind: 'point',
  },
] as FeatureType[];
