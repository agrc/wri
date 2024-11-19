import { describe, expect, it } from 'vitest';
import { featureTypes, projectStatus } from '../data/filters';
import { createCentroidTemplate, createDefinitionExpression } from './FilterProvider';

// when proposed current pending completed and completed status are selected and a terrestrial feature type is selected the following expression is generated
describe('createDefinitionExpression', () => {
  it('should set false expression when no items are selected', () => {
    const state = {
      projects: new Set([]),
      features: {
        types: new Set([]),
        join: 'and' as const,
      },
    };

    const result = createDefinitionExpression(state.projects, state.features);
    expect(result.projects).toBe('1=0');
    expect(result.features).toBe('1=0');
    expect(result.expression).toBe('1=0');
  });

  it('should show nothing if all feature types are off', () => {
    const state = {
      projects: 'all' as const,
      features: {
        types: new Set([]),
        join: 'and' as const,
      },
    };

    const result = createDefinitionExpression(state.projects, state.features);
    expect(result.projects).toBe('1=0');
    expect(result.features).toBe('1=0');
    expect(result.expression).toBe('1=0');
  });

  it('should show nothing if all project status are off', () => {
    const state = {
      projects: new Set([]),
      features: {
        types: 'all' as const,
        join: 'and' as const,
      },
    };

    const result = createDefinitionExpression(state.projects, state.features);
    expect(result.projects).toBe('1=0');
    expect(result.features).toBe('1=0');
    expect(result.expression).toBe('1=0');
  });

  it('should set no expression when special all', () => {
    const state = {
      projects: 'all' as const,
      features: {
        types: 'all' as const,
        join: 'and' as const,
      },
    };

    const result = createDefinitionExpression(state.projects, state.features);
    expect(result.projects).toBe('');
    expect(result.features).toBe('');
    expect(result.expression).toBe('');
  });

  it('should set no expression when all statuses and feature types are selected', () => {
    const state = {
      projects: new Set(projectStatus.map(({ value }) => value)),
      features: {
        types: new Set(featureTypes.map(({ featureType }) => featureType)),
        join: 'and' as const,
      },
    };

    const result = createDefinitionExpression(state.projects, state.features);
    expect(result.projects).toBe('');
    expect(result.features).toBe('');
    expect(result.expression).toBe('');
  });

  it('should generate correct centroid expression for multiple statuses and terrestrial feature type', () => {
    const state = {
      projects: new Set(projectStatus.filter((x) => x.default).map(({ value }) => value)),
      features: {
        types: new Set(['Terrestrial Treatment Area']),
        join: 'or' as const,
      },
    };

    const result = createDefinitionExpression(state.projects, state.features);
    expect(result.projects).toBe("Status in('Proposed','Current','Pending Completed','Completed')");
    expect(result.features).toBe('((Project_ID in(select Project_ID from POLY where TypeCode in(1))))');
    expect(result.expression).toBe(
      "Status in('Proposed','Current','Pending Completed','Completed') and ((Project_ID in(select Project_ID from POLY where TypeCode in(1))))",
    );
  });

  it('should skip joining with and if status are empty', () => {
    const state = {
      projects: 'all' as const,
      features: {
        types: new Set(['Terrestrial Treatment Area']),
        join: 'or' as const,
      },
    };

    const result = createDefinitionExpression(state.projects, state.features);
    expect(result.projects).toBe('');
    expect(result.features).toBe('((Project_ID in(select Project_ID from POLY where TypeCode in(1))))');
    expect(result.expression).toBe('((Project_ID in(select Project_ID from POLY where TypeCode in(1))))');
  });

  it('should skip joining with and if features are empty', () => {
    const state = {
      projects: new Set(['Proposed']),
      features: {
        types: 'all' as const,
        join: 'or' as const,
      },
    };

    const result = createDefinitionExpression(state.projects, state.features);
    expect(result.projects).toBe("Status in('Proposed')");
    expect(result.features).toBe('');
    expect(result.expression).toBe("Status in('Proposed')");
  });
});

describe('createCentroidTemplate', () => {
  it('should return empty string when no codes are provided', () => {
    const codesByType = {
      Point: [],
      Line: [],
      Poly: [],
    };

    const result = createCentroidTemplate(codesByType, 'and');
    expect(result).toBe('1=0');
  });

  it('should only include the point table for point types', () => {
    const codesByType = {
      Point: [5],
      Line: [],
      Poly: [],
    };

    const result = createCentroidTemplate(codesByType, 'and');
    expect(result).toBe(`((Project_ID in(select Project_ID from POINT where TypeCode in(5))))`);
  });

  it('should join sub queries by the join value', () => {
    const codesByType = {
      Point: [5],
      Line: [1],
      Poly: [],
    };

    const result = createCentroidTemplate(codesByType, 'and');
    expect(result).toBe(
      `((Project_ID in(select Project_ID from POINT where TypeCode in(5))) and (Project_ID in(select Project_ID from LINE where TypeCode in(1))))`,
    );
  });
});
