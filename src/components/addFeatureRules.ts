const NO_ACTION_CATEGORIES = new Set(['affected area', 'other point feature']);
const SUBTYPE_ACTION_CATEGORIES = new Set(['guzzler', 'fish passage structure', 'fence', 'pipeline', 'dam']);
const RETREATMENT_ELIGIBLE_CATEGORIES = new Set([
  'terrestrial treatment area',
  'aquatic/riparian treatment area',
]);

export const isNoActionCategory = (category: string) => NO_ACTION_CATEGORIES.has(category.toLowerCase());

export const isSubtypeActionCategory = (category: string) => SUBTYPE_ACTION_CATEGORIES.has(category.toLowerCase());

export const isRetreatmentEligibleCategory = (category: string) =>
  RETREATMENT_ELIGIBLE_CATEGORIES.has(category.toLowerCase());
