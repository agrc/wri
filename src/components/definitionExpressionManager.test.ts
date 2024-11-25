import { type Key } from 'react-aria';
import { type Selection } from 'react-stately';
import { describe, expect, it } from 'vitest';
import { featureTypes, projectStatus } from './data/filters';
import { generateDefinitionExpression } from './definitionExpressionManager';

const emptySet = new Set([]);
const all = 'all' as const;
const and = 'and' as const;
const or = 'or' as const;

type State = {
  projects: Selection;
  features: Selection;
  join: 'and' | 'or';
};

describe('createDefinitionExpression', () => {
  it('should request no records when no filters are selected', () => {
    const state: State = {
      projects: emptySet,
      features: emptySet,
      join: or,
    };
    const result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: '1=0',
      point: '1=0',
      line: '1=0',
      poly: '1=0',
    });
  });
  it('should should request no records when no project status are selected', () => {
    const state: State = {
      projects: emptySet,
      features: new Set(['Guzzler']),
      join: or,
    };
    const result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: '1=0',
      point: '1=0',
      line: '1=0',
      poly: '1=0',
    });
  });
  it('should should request no records when no feature types are selected', () => {
    const state: State = {
      projects: all,
      features: emptySet,
      join: or,
    };
    const result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: '1=0',
      point: '1=0',
      line: '1=0',
      poly: '1=0',
    });
  });
  it('should request all records when all filters are selected', () => {
    // using 'all' and all keys
    const state: State = {
      projects: all,
      features: all,
      join: or,
    };
    let result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: '',
      point: '',
      line: '',
      poly: '',
    });

    state.projects = new Set(projectStatus.map(({ value }) => value));
    state.features = new Set(featureTypes.map(({ featureType }) => featureType));

    result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: '',
      point: '',
      line: '',
      poly: '',
    });
  });
  it('should request all records when all type filters are selected', () => {
    // using 'all' and all keys
    const state: State = {
      projects: new Set(['Proposed']),
      features: new Set(featureTypes.map(({ featureType }) => featureType)),
      join: or,
    };
    const result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: "Status in('Proposed')",
      point: "StatusDescription in('Proposed')",
      line: "StatusDescription in('Proposed')",
      poly: "StatusDescription in('Proposed')",
    });
  });
  it('should use project status values when selecting project status', () => {
    const state: State = {
      projects: new Set<Key>(['Proposed', 'Current']),
      features: all,
      join: or,
    };
    let result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: "Status in('Proposed','Current')",
      point: "StatusDescription in('Proposed','Current')",
      line: "StatusDescription in('Proposed','Current')",
      poly: "StatusDescription in('Proposed','Current')",
    });

    state.join = and;

    result = generateDefinitionExpression(state);
    expect(result).toEqual({
      centroids: "Status in('Proposed','Current')",
      point: "StatusDescription in('Proposed','Current')",
      line: "StatusDescription in('Proposed','Current')",
      poly: "StatusDescription in('Proposed','Current')",
    });
  });
  it('should use feature type codes when selecting feature types', () => {
    const state: State = {
      projects: all,
      features: new Set<Key>(['Terrestrial Treatment Area']),
      join: or,
    };
    let result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: 'Project_ID in(select Project_ID from POLY where TypeCode in(1))',
      point: '1=0',
      line: '1=0',
      poly: 'TypeCode in(1)',
    });

    state.features = new Set<Key>(['Terrestrial Treatment Area', 'Fish passage structure', 'Dam']);
    result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids:
        'Project_ID in(select Project_ID from POINT where TypeCode in(9) union select Project_ID from LINE where TypeCode in(12) union select Project_ID from POLY where TypeCode in(1))',
      point: 'TypeCode in(9)',
      line: 'TypeCode in(12)',
      poly: 'TypeCode in(1)',
    });

    state.features = new Set<Key>(['Dam']);
    result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: 'Project_ID in(select Project_ID from LINE where TypeCode in(12))',
      point: '1=0',
      line: 'TypeCode in(12)',
      poly: '1=0',
    });
  });
  it('should only apply selected feature types to its containing table', () => {
    const state: State = {
      projects: all,
      features: new Set<Key>(['Guzzler', 'Terrestrial Treatment Area', 'Affected Area']),
      join: or,
    };
    const result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids:
        'Project_ID in(select Project_ID from POINT where TypeCode in(5) union select Project_ID from POLY where TypeCode in(1,3))',
      point: 'TypeCode in(5)',
      line: '1=0',
      poly: 'TypeCode in(1,3)',
    });
  });
  it('should use the user input join value or when selecting feature types with or', () => {
    const state: State = {
      projects: all,
      features: new Set<Key>(['Guzzler', 'Terrestrial Treatment Area', 'Affected Area']),
      join: or,
    };
    const result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids:
        'Project_ID in(select Project_ID from POINT where TypeCode in(5) union select Project_ID from POLY where TypeCode in(1,3))',
      point: 'TypeCode in(5)',
      line: '1=0',
      poly: 'TypeCode in(1,3)',
    });
  });
  it('should use the user input join value intersect when selecting feature types with and', () => {
    const state: State = {
      projects: all,
      features: new Set<Key>(['Fish passage structure', 'Dam']),
      join: and,
    };
    let result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids:
        'Project_ID in(select Project_ID from POINT where TypeCode=9 intersect select Project_ID from LINE where TypeCode=12)',
      point:
        'TypeCode in(9) and Project_ID in(select Project_ID from POINT where TypeCode=9 intersect select Project_ID from LINE where TypeCode=12)',
      line: 'TypeCode in(12) and Project_ID in(select Project_ID from POINT where TypeCode=9 intersect select Project_ID from LINE where TypeCode=12)',
      poly: '1=0',
    });

    state.features = new Set(['Dam']);
    result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: 'Project_ID in(select Project_ID from LINE where TypeCode=12)',
      point: '1=0',
      line: 'TypeCode in(12) and Project_ID in(select Project_ID from LINE where TypeCode=12)',
      poly: '1=0',
    });
  });
  it('should not join feature and project expressions if one is empty', () => {
    // testing both sides being empty
    let state: State = {
      projects: all,
      features: new Set<Key>(['Terrestrial Treatment Area']),
      join: or,
    };
    let result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: 'Project_ID in(select Project_ID from POLY where TypeCode in(1))',
      point: '1=0',
      line: '1=0',
      poly: 'TypeCode in(1)',
    });

    state = {
      projects: new Set<Key>(['Proposed', 'Current']),
      features: all,
      join: or,
    };
    result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: "Status in('Proposed','Current')",
      point: "StatusDescription in('Proposed','Current')",
      line: "StatusDescription in('Proposed','Current')",
      poly: "StatusDescription in('Proposed','Current')",
    });
  });
  it('should join feature and project expressions with "and"', () => {
    const state: State = {
      projects: new Set<Key>(['Proposed', 'Current']),
      features: new Set<Key>(['Terrestrial Treatment Area']),
      join: or,
    };
    const result = generateDefinitionExpression(state);

    expect(result).toEqual({
      centroids: "Status in('Proposed','Current') and Project_ID in(select Project_ID from POLY where TypeCode in(1))",
      point: '1=0',
      line: '1=0',
      poly: "StatusDescription in('Proposed','Current') and TypeCode in(1)",
    });
  });
});
