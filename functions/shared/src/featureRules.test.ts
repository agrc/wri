import { describe, expect, it } from 'vitest';
import {
  hasRequiredHerbicideSelections,
  isAffectedAreaCategory,
  isHerbicideAction,
  isNoActionCategory,
  isRetreatmentEligibleCategory,
  isRetreatmentEligibleFeatureType,
  isStreamEligibleCategory,
  isStreamEligibleFeatureType,
  isSubtypeActionCategory,
  shouldShowHerbicideField,
} from './featureRules.js';

describe('featureRules', () => {
  it('identifies no-action categories', () => {
    expect(isNoActionCategory('Affected Area')).toBe(false);
    expect(isNoActionCategory('Other Point Feature')).toBe(true);
    expect(isNoActionCategory('Terrestrial Treatment Area')).toBe(false);
  });

  it('identifies affected area categories', () => {
    expect(isAffectedAreaCategory('Affected Area')).toBe(true);
    expect(isAffectedAreaCategory('Terrestrial Treatment Area')).toBe(false);
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

  it('exposes the feature-type retreatment alias', () => {
    expect(isRetreatmentEligibleFeatureType('Terrestrial Treatment Area')).toBe(true);
    expect(isRetreatmentEligibleFeatureType('Aquatic/Riparian Treatment Area')).toBe(true);
    expect(isRetreatmentEligibleFeatureType('Affected Area')).toBe(false);
    expect(isRetreatmentEligibleFeatureType('Easement/Acquisition')).toBe(false);
  });

  it('limits stream extraction to aquatic/riparian treatment areas', () => {
    expect(isStreamEligibleCategory('Aquatic/Riparian Treatment Area')).toBe(true);
    expect(isStreamEligibleCategory('Terrestrial Treatment Area')).toBe(false);
    expect(isStreamEligibleCategory('Affected Area')).toBe(false);
    expect(isStreamEligibleCategory('Fence')).toBe(false);
  });

  it('exposes the feature-type stream-eligibility alias', () => {
    expect(isStreamEligibleFeatureType('Aquatic/Riparian Treatment Area')).toBe(true);
    expect(isStreamEligibleFeatureType('Terrestrial Treatment Area')).toBe(false);
    expect(isStreamEligibleFeatureType('Easement/Acquisition')).toBe(false);
  });

  it('matches the herbicide action case-insensitively', () => {
    expect(isHerbicideAction('Herbicide Application')).toBe(true);
    expect(isHerbicideAction('HERBICIDE APPLICATION')).toBe(true);
    expect(isHerbicideAction('Mechanical Treatment')).toBe(false);
  });

  it('only shows the herbicide field when the herbicide action and a treatment are selected', () => {
    expect(shouldShowHerbicideField('Herbicide Application', 'Aerial (helicopter)', 2)).toBe(true);
    expect(shouldShowHerbicideField('Mechanical Treatment', 'Roller/crusher', 2)).toBe(false);
    expect(shouldShowHerbicideField('Herbicide Application', '', 2)).toBe(false);
    expect(shouldShowHerbicideField('Herbicide Application', 'Aerial (helicopter)', 0)).toBe(false);
  });

  it('requires a selected herbicide when the herbicide field is shown', () => {
    expect(hasRequiredHerbicideSelections('Herbicide Application', 'Aerial (helicopter)', ['Imazapic'], 2)).toBe(true);
    expect(hasRequiredHerbicideSelections('Herbicide Application', 'Aerial (helicopter)', [''], 2)).toBe(false);
    expect(hasRequiredHerbicideSelections('Herbicide Application', 'Aerial (helicopter)', [], 2)).toBe(false);
    expect(hasRequiredHerbicideSelections('Mechanical Treatment', 'Roller/crusher', [], 2)).toBe(true);
  });
});
