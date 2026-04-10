import * as areaOperator from '@arcgis/core/geometry/operators/areaOperator.js';
import * as cutOperator from '@arcgis/core/geometry/operators/cutOperator.js';
import * as lengthOperator from '@arcgis/core/geometry/operators/lengthOperator.js';
import type { FeatureTable } from '@ugrc/wri-shared/types';

export const CUT_DRAFT_NOOP_ERROR = 'The cut line did not split any drafted geometry.';

type CuttableFeatureTable = Extract<FeatureTable, 'POLY' | 'LINE'>;
type SupportedDraftGeometry = __esri.Polygon | __esri.Polyline;

type CutDraftGeometriesParams = {
  geometries: __esri.Geometry[];
  cutGeometry: __esri.Polyline;
  table: CuttableFeatureTable;
};

type CutDraftGeometriesResult = {
  geometries: __esri.Geometry[];
  changed: boolean;
  error: string | null;
};

export const canCutDraftGeometries = (table: FeatureTable | undefined, geometries: __esri.Geometry[]): boolean => {
  return (table === 'POLY' || table === 'LINE') && geometries.length > 0;
};

const chooseDominantGeometry = (
  pieces: SupportedDraftGeometry[],
  table: CuttableFeatureTable,
): SupportedDraftGeometry | null => {
  let bestGeometry: SupportedDraftGeometry | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const piece of pieces) {
    const score =
      table === 'POLY'
        ? areaOperator.execute(piece as __esri.Polygon)
        : lengthOperator.execute(piece as __esri.Polyline);

    if (score > bestScore) {
      bestScore = score;
      bestGeometry = piece;
    }
  }

  return bestGeometry;
};

export const cutDraftGeometries = ({
  geometries,
  cutGeometry,
  table,
}: CutDraftGeometriesParams): CutDraftGeometriesResult => {
  let changed = false;

  const nextGeometries = geometries.map((geometry) => {
    const currentGeometry = geometry as SupportedDraftGeometry;
    const pieces = (cutOperator.execute(currentGeometry, cutGeometry) ?? []).filter(
      (piece) => piece != null,
    ) as SupportedDraftGeometry[];

    if (pieces.length < 2) {
      return geometry;
    }

    const dominantGeometry = chooseDominantGeometry(pieces, table);

    if (!dominantGeometry) {
      throw new Error('Unable to determine which cut geometry should survive.');
    }

    changed = true;

    return dominantGeometry;
  });

  return {
    geometries: nextGeometries,
    changed,
    error: changed ? null : CUT_DRAFT_NOOP_ERROR,
  };
};
