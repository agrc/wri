export const projectStatus = [
  {
    code: 1,
    value: 'Draft',
  },
  {
    code: 2,
    value: 'Proposed',
  },
  {
    code: 3,
    value: 'Current',
  },
  {
    code: 4,
    value: 'Pending Completed',
  },
  {
    code: 5,
    value: 'Completed',
  },
  {
    code: 6,
    value: 'Cancelled',
  },
];
export type ProjectStatus = (typeof projectStatus)[number];

export const featureType = [
  {
    code: 1,
    featureType: 'Terrestrial Treatment Area',
    type: 'Poly',
  },
  {
    code: 2,
    featureType: 'Aquatic/Riparian Treatment Area',
    type: 'Poly',
  },
  {
    code: 3,
    featureType: 'Affected Area',
    type: 'Poly',
  },
  {
    code: 4,
    featureType: 'Easement/Acquisition',
    type: 'Poly',
  },
  {
    code: 5,
    featureType: 'Guzzler',
    type: 'Point',
  },
  {
    code: 8,
    featureType: 'Other point feature',
    type: 'Point',
  },
  {
    code: 9,
    featureType: 'Fish passage structure',
    type: 'Point',
  },
  {
    code: 10,
    featureType: 'Fence',
    type: 'Line',
  },
  {
    code: 11,
    featureType: 'Pipeline',
    type: 'Line',
  },
  {
    code: 12,
    featureType: 'Dam',
    type: 'Line',
  },
  {
    code: 13,
    featureType: 'Water development point feature',
    type: 'Point',
  },
];
