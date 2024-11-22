import { type Selection } from 'react-stately';
import { featureTypes, projectStatus } from './data/filters';

const allRecords = '';
const noRecords = '1=0' as const;
const all = 'all' as const;
const and = 'and' as const;
const or = 'or' as const;

const full = featureTypes.reduce(
  (acc, { type }) => {
    if (type === 'point') acc.point += 1;
    if (type === 'line') acc.line += 1;
    if (type === 'poly') acc.poly += 1;
    return acc;
  },
  { point: 0, line: 0, poly: 0 },
);

const getFeatureTablePredicates = (keys: Selection) => {
  if (typeof keys === 'string' && keys === all) {
    return {
      point: allRecords,
      line: allRecords,
      poly: allRecords,
    };
  }

  const filtersByTable = Array.from(keys).reduce(
    (acc, type) => {
      const feature = featureTypes.find(({ featureType }) => featureType === type);
      if (feature) {
        if (!acc[feature.type]) {
          acc[feature.type] = [];
        }
        acc[feature.type].push({ code: feature.code, type: `'${feature.featureType}'` });
      }
      return acc;
    },
    {} as Record<string, { code: number; type: string }[]>,
  );

  return filtersByTable;
};

const getProjectPredicate = (keys: Selection) => {
  if (keys instanceof Set) {
    if (keys.size === 0) {
      return noRecords;
    }

    if (keys.size === projectStatus.length) {
      return allRecords;
    }
  }

  if (typeof keys === 'string' && keys === all) {
    return allRecords;
  }

  return Array.from(keys)
    .map((status) => `'${status}'`)
    .join(',');
};

const generateExpressions = (
  projectPredicate: string,
  featurePredicates: Record<
    'point' | 'line' | 'poly',
    {
      code: number;
      type: string;
    }[]
  >,
  join: 'and' | 'or',
) => {
  // if the join style is or, we can use sql in statements for each table
  if (join === or) {
    const result = {
      centroids: '',
      point: '',
      line: '',
      poly: '',
    };

    // if there is a project status filter, we can use it for all tables
    if (projectPredicate) {
      const featureStatusExpression = `StatusDescription in(${projectPredicate})`;

      result.centroids = `Status in(${projectPredicate})`;
      result.point = featureStatusExpression;
      result.line = featureStatusExpression;
      result.poly = featureStatusExpression;
    }

    const expressions = [];

    if ((featurePredicates?.point ?? 0).length) {
      if (featurePredicates.point.length === full.point) {
        result.point = allRecords;
      } else {
        if (result.point) {
          result.point += ' and ';
        }

        const codes = featurePredicates.point.map(({ code }) => code).join(',');

        expressions.push(`select Project_ID from POINT where TypeCode in(${codes})`);
        result.point += `TypeCode in(${codes})`;
      }
    } else {
      result.point = typeof featurePredicates?.point === 'string' ? result.point : '1=0';
    }

    if ((featurePredicates?.line ?? 0).length) {
      if (featurePredicates.line.length === full.line) {
        result.point = allRecords;
      } else {
        if (result.line) {
          result.line += ' and ';
        }

        const codes = featurePredicates.line.map(({ code }) => code).join(',');

        expressions.push(`select Project_ID from LINE where TypeCode in(${codes})`);
        result.line += `TypeCode in(${codes})`;
      }
    } else {
      result.line = typeof featurePredicates?.line === 'string' ? result.line : '1=0';
    }

    if ((featurePredicates?.poly ?? 0).length) {
      if (featurePredicates.poly.length === full.poly) {
        result.point = allRecords;
      } else {
        if (result.poly) {
          result.poly += ' and ';
        }

        const codes = featurePredicates.poly.map(({ code }) => code).join(',');

        expressions.push(`select Project_ID from POLY where TypeCode in(${codes})`);
        result.poly += `TypeCode in(${codes})`;
      }
    } else {
      result.poly = typeof featurePredicates?.poly === 'string' ? result.poly : '1=0';
    }

    if (expressions.length === 0) {
      return result;
    }

    if (result.centroids) {
      if (expressions.length > 0) {
        result.centroids += ' and ';
      }

      if (expressions.length === 1) {
        result.centroids += `Project_ID in(${expressions[0]})`;

        return result;
      }

      result.centroids += `Project_ID in(${expressions.join(` union `)})`;

      return result;
    }

    result.centroids += `Project_ID in(${expressions.join(` union `)})`;

    return result;
  }
};

export const generateDefinitionExpression = ({
  projects,
  features,
  join,
}: {
  projects: Selection;
  features: Selection;
  join: 'and' | 'or';
}) => {
  const projectPredicate = getProjectPredicate(projects);
  const featurePredicates = getFeatureTablePredicates(features);

  // if nothing is selected in either filter, no features should be displayed
  if (projectPredicate === noRecords || Object.values(featurePredicates).every((x) => x === noRecords)) {
    return {
      centroids: noRecords,
      point: noRecords,
      line: noRecords,
      poly: noRecords,
    };
  }

  // empty set mean no filters so no records can be matched
  if (
    projectPredicate === allRecords &&
    Object.entries(featurePredicates).every(([key, value]) => value.length === full[key as keyof typeof full])
  ) {
    return {
      centroids: allRecords,
      point: allRecords,
      line: allRecords,
      poly: allRecords,
    };
  }

  const expressions = generateExpressions(projectPredicate, featurePredicates, join);

  return expressions;
};
