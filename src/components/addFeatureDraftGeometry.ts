import * as areaOperator from '@arcgis/core/geometry/operators/areaOperator.js';
import * as cutOperator from '@arcgis/core/geometry/operators/cutOperator.js';
import * as geodesicBufferOperator from '@arcgis/core/geometry/operators/geodesicBufferOperator.js';
import * as lengthOperator from '@arcgis/core/geometry/operators/lengthOperator.js';
import type { FeatureTable } from '@ugrc/wri-shared/types';

export const CUT_DRAFT_NOOP_ERROR = 'The cut line did not split any drafted geometry.';
export const BUFFER_DRAFT_NOOP_ERROR = 'Draw at least one line before buffering.';
export const INVALID_BUFFER_DISTANCE_ERROR = 'Choose a buffer distance of 5, 10, or 15 meters.';
export const BUFFER_DRAFT_DISTANCES = [5, 10, 15] as const;

type CuttableFeatureTable = Extract<FeatureTable, 'POLY' | 'LINE'>;
type BufferableFeatureTable = Extract<FeatureTable, 'POLY'>;
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

type BufferDraftGeometriesParams = {
  geometries: __esri.Geometry[];
  distance: number;
  table: BufferableFeatureTable;
};

const isPolygonGeometry = (geometry: __esri.Geometry): geometry is __esri.Polygon => geometry.type === 'polygon';

const isPolylineGeometry = (geometry: __esri.Geometry): geometry is __esri.Polyline => geometry.type === 'polyline';

const isSupportedBufferDistance = (distance: number): distance is (typeof BUFFER_DRAFT_DISTANCES)[number] => {
  return BUFFER_DRAFT_DISTANCES.includes(distance as (typeof BUFFER_DRAFT_DISTANCES)[number]);
};

export const canCutDraftGeometries = (table: FeatureTable | undefined, geometries: __esri.Geometry[]): boolean => {
  if (geometries.length === 0) {
    return false;
  }

  if (table === 'POLY') {
    return geometries.every(isPolygonGeometry);
  }

  if (table === 'LINE') {
    return geometries.every(isPolylineGeometry);
  }

  return false;
};

export const canBufferDraftGeometries = (table: FeatureTable | undefined, geometries: __esri.Geometry[]): boolean => {
  return table === 'POLY' && geometries.some(isPolylineGeometry);
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

export const bufferDraftGeometries = async ({
  geometries,
  distance,
  table,
}: BufferDraftGeometriesParams): Promise<CutDraftGeometriesResult> => {
  if (table !== 'POLY') {
    return {
      geometries,
      changed: false,
      error: BUFFER_DRAFT_NOOP_ERROR,
    };
  }

  if (!isSupportedBufferDistance(distance)) {
    return {
      geometries,
      changed: false,
      error: INVALID_BUFFER_DISTANCE_ERROR,
    };
  }

  const lineGeometries = geometries.filter(isPolylineGeometry);

  if (lineGeometries.length === 0) {
    return {
      geometries,
      changed: false,
      error: BUFFER_DRAFT_NOOP_ERROR,
    };
  }

  if (!geodesicBufferOperator.isLoaded()) {
    await geodesicBufferOperator.load();
  }

  const preservedGeometries = geometries.filter((geometry) => !isPolylineGeometry(geometry));
  const bufferedGeometries = geodesicBufferOperator.executeMany(lineGeometries, [distance], {
    unit: 'meters',
    union: true,
  });
  const nextGeometries = [...preservedGeometries, ...bufferedGeometries];

  return {
    geometries: nextGeometries,
    changed: bufferedGeometries.length > 0,
    error: bufferedGeometries.length > 0 ? null : BUFFER_DRAFT_NOOP_ERROR,
  };
};
