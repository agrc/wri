import { describe, expect, it } from 'vitest';
import { isHerbicideAction, shouldShowHerbicideField } from './addFeatureFormHelpers';

describe('addFeatureFormHelpers', () => {
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
});
