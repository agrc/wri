import { type Selection } from 'react-stately';
import { featureTypes, projectStatus } from './data/filters';

const allRecords = '';
const noRecords = '1=0' as const;
const all = 'all' as const;
const or = 'or' as const;
const wriFunded = `Project_ID in(select Project_ID from PROJECTCATEGORYFUNDING where CategoryFundingID=1)`;

type GeometryKey = 'point' | 'line' | 'poly';
const TABLES: Record<GeometryKey, string> = {
  point: 'POINT',
  line: 'LINE',
  poly: 'POLY',
};

type FeatureItem = { code: number; type: string };
// Normalized: always return all keys, with either a list of items, '' for all, or '1=0' for none
type NormalizedFeaturePredicates = Record<GeometryKey, FeatureItem[] | '' | typeof noRecords>;

const addPossibleConjunction = (phrase: string) => {
  if (!phrase || [allRecords, noRecords].includes(phrase)) {
    return phrase;
  }

  return `${phrase} and `;
};

const full = featureTypes.reduce(
  (acc, { type }) => {
    if (type === 'point') {
      acc.point += 1;
    }
    if (type === 'line') {
      acc.line += 1;
    }
    if (type === 'poly') {
      acc.poly += 1;
    }
    return acc;
  },
  { point: 0, line: 0, poly: 0 },
);

const getFeatureTablePredicates = (keys: Selection): NormalizedFeaturePredicates => {
  if (typeof keys === 'string' && keys === all) {
    return {
      point: allRecords,
      line: allRecords,
      poly: allRecords,
    };
  }

  const buckets: Record<GeometryKey, FeatureItem[]> = {
    point: [],
    line: [],
    poly: [],
  };

  for (const type of Array.from(keys)) {
    const feature = featureTypes.find(({ featureType }) => featureType === type);
    if (!feature) {
      continue;
    }
    buckets[feature.type as GeometryKey].push({ code: feature.code, type: `'${feature.featureType}'` });
  }

  return {
    point: buckets.point.length === 0 ? noRecords : buckets.point.length === full.point ? allRecords : buckets.point,
    line: buckets.line.length === 0 ? noRecords : buckets.line.length === full.line ? allRecords : buckets.line,
    poly: buckets.poly.length === 0 ? noRecords : buckets.poly.length === full.poly ? allRecords : buckets.poly,
  };
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

// Small helpers to keep formatting identical across branches
const featureStatusExpression = (predicateCsv: string) => `StatusDescription in(${predicateCsv})`;
const centroidStatusExpression = (predicateCsv: string) => `Status in(${predicateCsv})`;
const unionProjectIdSubqueries = (g: GeometryKey, items: FeatureItem[]) =>
  `select Project_ID from ${TABLES[g]} where TypeDescription in(${items.map(({ type }) => type).join(',')})`;
const intersectProjectIdSubqueries = (g: GeometryKey, items: FeatureItem[]) =>
  items
    .map(({ type }) => `Project_ID in(select Project_ID from ${TABLES[g]} where TypeDescription=${type})`)
    .join(' and ');

const allTypesSelectedForAllGeometries = (predicates: NormalizedFeaturePredicates) =>
  (['point', 'line', 'poly'] as GeometryKey[]).every((k) => predicates[k] === allRecords);

const generateExpressions = (
  projectPredicate: string,
  featurePredicates: NormalizedFeaturePredicates,
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
      const featureStatus = featureStatusExpression(projectPredicate);
      result.centroids = addPossibleConjunction(result.centroids);
      result.centroids += centroidStatusExpression(projectPredicate);

      result.point = addPossibleConjunction(result.point);
      result.point += featureStatus;

      result.line = addPossibleConjunction(result.line);
      result.line += featureStatus;

      result.poly = addPossibleConjunction(result.poly);
      result.poly += featureStatus;
    }

    const expressions: string[] = [];

    if (Array.isArray(featurePredicates.point)) {
      // normalized guarantees array means partial selection
      result.point = addPossibleConjunction(result.point);
      const types = featurePredicates.point.map(({ type }) => type).join(',');
      expressions.push(unionProjectIdSubqueries('point', featurePredicates.point));
      result.point += `TypeDescription in(${types})`;
    } else if (featurePredicates.point === noRecords) {
      result.point = noRecords;
    } else if (
      featurePredicates.point === allRecords &&
      (featurePredicates.line !== allRecords || featurePredicates.poly !== allRecords)
    ) {
      expressions.push(`select Project_ID from ${TABLES.point}`);
    }

    if (Array.isArray(featurePredicates.line)) {
      result.line = addPossibleConjunction(result.line);
      const types = featurePredicates.line.map(({ type }) => type).join(',');
      expressions.push(unionProjectIdSubqueries('line', featurePredicates.line));
      result.line += `TypeDescription in(${types})`;
    } else if (featurePredicates.line === noRecords) {
      result.line = noRecords;
    } else if (
      featurePredicates.line === allRecords &&
      (featurePredicates.point !== allRecords || featurePredicates.poly !== allRecords)
    ) {
      expressions.push(`select Project_ID from ${TABLES.line}`);
    }

    if (Array.isArray(featurePredicates.poly)) {
      result.poly = addPossibleConjunction(result.poly);
      const types = featurePredicates.poly.map(({ type }) => type).join(',');
      expressions.push(unionProjectIdSubqueries('poly', featurePredicates.poly));
      result.poly += `TypeDescription in(${types})`;
    } else if (featurePredicates.poly === noRecords) {
      result.poly = noRecords;
    } else if (
      featurePredicates.poly === allRecords &&
      (featurePredicates.point !== allRecords || featurePredicates.line !== allRecords)
    ) {
      expressions.push(`select Project_ID from ${TABLES.poly}`);
    }

    if (expressions.length === 0) {
      return result;
    }

    result.centroids = addPossibleConjunction(result.centroids);

    if (expressions.length === 1) {
      result.centroids += `Project_ID in(${expressions[0]})`;
    } else {
      result.centroids += `(${expressions.map((exp) => `Project_ID in(${exp})`).join(` or `)})`;
    }

    return result;
  } else {
    if (projectPredicate) {
      const featureStatus = featureStatusExpression(projectPredicate);

      result.centroids = centroidStatusExpression(projectPredicate);
      result.point = featureStatus;
      result.line = featureStatus;
      result.poly = featureStatus;
    }

    const expressions: string[] = [];

    if (Array.isArray(featurePredicates.point)) {
      result.point = addPossibleConjunction(result.point);
      const predicate = intersectProjectIdSubqueries('point', featurePredicates.point);
      expressions.push(predicate);
      result.point += `TypeDescription in(${featurePredicates.point.map(({ type }) => `${type}`).join(',')})`;
    } else if (featurePredicates.point === noRecords) {
      result.point = noRecords;
    } else if (
      featurePredicates.point === allRecords &&
      (featurePredicates.line !== allRecords || featurePredicates.poly !== allRecords)
    ) {
      const values = featureTypes.filter((x) => x.type === 'point');
      expressions.push(
        ...values.map(
          ({ featureType }) =>
            `Project_ID in(select Project_ID from ${TABLES.point} where TypeDescription = '${featureType}')`,
        ),
      );
    }

    if (Array.isArray(featurePredicates.line)) {
      result.line = addPossibleConjunction(result.line);
      const predicate = intersectProjectIdSubqueries('line', featurePredicates.line);
      expressions.push(predicate);
      result.line += `TypeDescription in(${featurePredicates.line.map(({ type }) => `${type}`).join(',')})`;
    } else if (featurePredicates.line === noRecords) {
      result.line = noRecords;
    } else if (
      featurePredicates.line === allRecords &&
      (featurePredicates.point !== allRecords || featurePredicates.poly !== allRecords)
    ) {
      const values = featureTypes.filter((x) => x.type === 'line');
      expressions.push(
        ...values.map(
          ({ featureType }) =>
            `Project_ID in(select Project_ID from ${TABLES.line} where TypeDescription = '${featureType}')`,
        ),
      );
    }

    if (Array.isArray(featurePredicates.poly)) {
      result.poly = addPossibleConjunction(result.poly);
      const predicate = intersectProjectIdSubqueries('poly', featurePredicates.poly);
      expressions.push(predicate);
      result.poly += `TypeDescription in(${featurePredicates.poly.map(({ type }) => `${type}`).join(',')})`;
    } else if (featurePredicates.poly === noRecords) {
      result.poly = noRecords;
    } else if (
      featurePredicates.poly === allRecords &&
      (featurePredicates.point !== allRecords || featurePredicates.line !== allRecords)
    ) {
      const values = featureTypes.filter((x) => x.type === 'poly');
      expressions.push(
        ...values.map(
          ({ featureType }) =>
            `Project_ID in(select Project_ID from ${TABLES.poly} where TypeDescription = '${featureType}')`,
        ),
      );
    }

    if (expressions.length === 0) {
      return result;
    }

    result.centroids = addPossibleConjunction(result.centroids);
    result.centroids += expressions.join(` and `);

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
}): { centroids: string; point: string; line: string; poly: string } => {
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

  if (projectPredicate === allRecords && allTypesSelectedForAllGeometries(featurePredicates)) {
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
