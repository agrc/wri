export const NO_ACTION_CATEGORIES = new Set(['affected area', 'other point feature']);

export const SUBTYPE_ACTION_CATEGORIES = new Set(['guzzler', 'fish passage structure', 'fence', 'pipeline', 'dam']);

export const RETREATMENT_ELIGIBLE_CATEGORIES = new Set([
  'terrestrial treatment area',
  'aquatic/riparian treatment area',
]);

export const STREAM_ELIGIBLE_CATEGORIES = new Set(['aquatic/riparian treatment area']);

const HERBICIDE_ACTION_NAME = 'herbicide application';

export const isNoActionCategory = (category: string) => NO_ACTION_CATEGORIES.has(category.toLowerCase());

export const isSubtypeActionCategory = (category: string) => SUBTYPE_ACTION_CATEGORIES.has(category.toLowerCase());

export const isRetreatmentEligibleCategory = (category: string) =>
  RETREATMENT_ELIGIBLE_CATEGORIES.has(category.toLowerCase());

export const isRetreatmentEligibleFeatureType = isRetreatmentEligibleCategory;

export const isStreamEligibleCategory = (category: string) => STREAM_ELIGIBLE_CATEGORIES.has(category.toLowerCase());

export const isStreamEligibleFeatureType = isStreamEligibleCategory;

export const isHerbicideAction = (action: string) => action.trim().toLowerCase() === HERBICIDE_ACTION_NAME;

export const normalizeHerbicides = (herbicides: string[] | null | undefined): string[] => {
  return [...new Set((herbicides ?? []).map((herbicide) => herbicide.trim()).filter(Boolean))];
};

export const shouldShowHerbicideField = (action: string, treatment: string, herbicideCount: number) =>
  isHerbicideAction(action) && treatment.trim().length > 0 && herbicideCount > 0;

export const hasRequiredHerbicideSelections = (
  action: string,
  treatment: string,
  herbicides: string[],
  herbicideCount: number,
) => {
  if (!shouldShowHerbicideField(action, treatment, herbicideCount)) {
    return true;
  }

  return herbicides.length > 0 && herbicides.every((herbicide) => herbicide.trim().length > 0);
};
