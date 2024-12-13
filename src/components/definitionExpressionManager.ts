import { type Selection } from 'react-stately';
import { featureTypes, projectStatus } from './data/filters';

const allRecords = '';
const noRecords = '1=0' as const;
const all = 'all' as const;
const or = 'or' as const;
const wriFunded = `Project_ID in(select Project_ID from PROJECTCATEGORYFUNDING where CategoryFundingID=1)`;

const addPossibleConjunction = (phrase: string) => {
  if (!phrase || [allRecords, noRecords].includes(phrase)) {
    return phrase;
  }

  return `${phrase} and `;
};

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

        acc[feature.type]?.push({ code: feature.code, type: `'${feature.featureType}'` });
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
    | {
        code: number;
        type: string;
      }[]
    | string
  >,
  join: 'and' | 'or',
  wriFunding: boolean,
) => {
  const result = {
    centroids: '',
    point: '',
    line: '',
    poly: '',
  };

  if (join === or) {
    // wri funding
    if (wriFunding) {
      result.centroids = wriFunded;
      result.point = wriFunded;
      result.line = wriFunded;
      result.poly = wriFunded;
    }

    // if there is a project status filter, we can use it for all tables
    if (projectPredicate) {
      const featureStatusExpression = `StatusDescription in(${projectPredicate})`;
      result.centroids = addPossibleConjunction(result.centroids);
      result.centroids += `Status in(${projectPredicate})`;

      result.point = addPossibleConjunction(result.point);
      result.point += featureStatusExpression;

      result.line = addPossibleConjunction(result.line);
      result.line += featureStatusExpression;

      result.poly = addPossibleConjunction(result.poly);
      result.poly += featureStatusExpression;
    }

    const expressions = [];

    if (Array.isArray(featurePredicates.point)) {
      if (featurePredicates.point.length !== full.point) {
        result.point = addPossibleConjunction(result.point);

        const types = featurePredicates.point.map(({ type }) => type).join(',');

        expressions.push(`select Project_ID from POINT where TypeDescription in(${types})`);
        result.point += `TypeDescription in(${types})`;
      }
    } else {
      result.point = typeof featurePredicates?.point === 'string' ? result.point : '1=0';
    }

    if (Array.isArray(featurePredicates.line)) {
      if (featurePredicates.line.length !== full.line) {
        result.line = addPossibleConjunction(result.line);

        const types = featurePredicates.line.map(({ type }) => type).join(',');

        expressions.push(`select Project_ID from LINE where TypeDescription in(${types})`);
        result.line += `TypeDescription in(${types})`;
      }
    } else {
      result.line = typeof featurePredicates?.line === 'string' ? result.line : '1=0';
    }

    if (Array.isArray(featurePredicates.poly)) {
      if (featurePredicates.poly.length !== full.poly) {
        result.poly = addPossibleConjunction(result.poly);

        const types = featurePredicates.poly.map(({ type }) => type).join(',');

        expressions.push(`select Project_ID from POLY where TypeDescription in(${types})`);
        result.poly += `TypeDescription in(${types})`;
      }
    } else {
      result.poly = typeof featurePredicates?.poly === 'string' ? result.poly : '1=0';
    }

    if (expressions.length === 0) {
      return result;
    }

    if (result.centroids) {
      if (expressions.length > 0) {
        result.centroids = addPossibleConjunction(result.centroids);
      }

      if (expressions.length === 1) {
        result.centroids += `Project_ID in(${expressions[0]})`;

        return result;
      }
    }

    result.centroids += `Project_ID in(${expressions.join(` union `)})`;

    return result;
  } else {
    if (projectPredicate) {
      const featureStatusExpression = `StatusDescription in(${projectPredicate})`;

      result.centroids = `Status in(${projectPredicate})`;
      result.point = featureStatusExpression;
      result.line = featureStatusExpression;
      result.poly = featureStatusExpression;
    }

    const expressions = [];

    if (Array.isArray(featurePredicates.point)) {
      result.point = addPossibleConjunction(result.point);

      const predicate = featurePredicates.point
        .map(({ type }) => `select Project_ID from POINT where TypeDescription=${type}`)
        .join(' intersect ');

      expressions.push(predicate);
      result.point += `TypeDescription in${featurePredicates.point.map(({ type }) => `(${type})`).join(',')}`;
    } else {
      result.point = typeof featurePredicates?.point === 'string' ? result.point : '1=0';
    }

    if (Array.isArray(featurePredicates.line)) {
      result.line = addPossibleConjunction(result.line);

      const predicate = featurePredicates.line
        .map(({ type }) => `select Project_ID from LINE where TypeDescription=${type}`)
        .join(' intersect ');

      expressions.push(predicate);
      result.line += `TypeDescription in${featurePredicates.line.map(({ type }) => `(${type})`).join(',')}`;
    } else {
      result.line = typeof featurePredicates?.line === 'string' ? result.line : '1=0';
    }

    if (Array.isArray(featurePredicates.poly)) {
      result.poly = addPossibleConjunction(result.poly);

      const predicate = featurePredicates.poly
        .map(({ type }) => `select Project_ID from POLY where TypeDescription=${type}`)
        .join(' intersect ');

      expressions.push(predicate);
      result.poly += `TypeDescription in${featurePredicates.poly.map(({ type }) => `(${type})`).join(',')}`;
    } else {
      result.poly = typeof featurePredicates?.poly === 'string' ? result.poly : '1=0';
    }

    if (expressions.length === 0) {
      return result;
    }

    result.centroids = addPossibleConjunction(result.centroids);
    result.point = addPossibleConjunction(result.point);
    result.line = addPossibleConjunction(result.line);
    result.poly = addPossibleConjunction(result.poly);

    const expression = `Project_ID in(${expressions.join(` intersect `)})`;
    result.centroids += expression;

    if (result.point && result.point != noRecords) {
      result.point += expression;
    }
    if (result.line && result.line != noRecords) {
      result.line += expression;
    }
    if (result.poly && result.poly != noRecords) {
      result.poly += expression;
    }

    return result;
  }
};

export const generateDefinitionExpression = ({
  projects,
  features,
  join,
  wriFunding,
}: {
  projects: Selection;
  features: Selection;
  join: 'and' | 'or';
  wriFunding: boolean;
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

  if (
    projectPredicate === allRecords &&
    Object.entries(featurePredicates).every(([key, value]) => value.length === full[key as keyof typeof full])
  ) {
    if (wriFunding) {
      return {
        centroids: wriFunded,
        point: wriFunded,
        line: wriFunded,
        poly: wriFunded,
      };
    }

    return {
      centroids: allRecords,
      point: allRecords,
      line: allRecords,
      poly: allRecords,
    };
  }

  const expressions = generateExpressions(projectPredicate, featurePredicates, join, wriFunding);

  return expressions;
};
