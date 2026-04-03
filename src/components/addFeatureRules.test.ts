import { describe, expect, it } from 'vitest';
import {
  isNoActionCategory,
  isRetreatmentEligibleCategory,
  isSubtypeActionCategory,
} from './addFeatureRules';

describe('addFeatureRules', () => {
  it('identifies no-action categories', () => {
    expect(isNoActionCategory('Affected Area')).toBe(true);
    expect(isNoActionCategory('Other Point Feature')).toBe(true);
    expect(isNoActionCategory('Terrestrial Treatment Area')).toBe(false);
  });

  it('identifies subtype-action categories', () => {
    expect(isSubtypeActionCategory('Dam')).toBe(true);
    expect(isSubtypeActionCategory('Fence')).toBe(true);
    expect(isSubtypeActionCategory('Fish Passage Structure')).toBe(true);
    expect(isSubtypeActionCategory('Water development point feature')).toBe(false);
  });

  it('limits retreatment to terrestrial and aquatic treatment areas', () => {
    expect(isRetreatmentEligibleCategory('Terrestrial Treatment Area')).toBe(true);
    expect(isRetreatmentEligibleCategory('Aquatic/Riparian Treatment Area')).toBe(true);
    expect(isRetreatmentEligibleCategory('Affected Area')).toBe(false);
    expect(isRetreatmentEligibleCategory('Easement/Acquisition')).toBe(false);
    expect(isRetreatmentEligibleCategory('Dam')).toBe(false);
  });
});
