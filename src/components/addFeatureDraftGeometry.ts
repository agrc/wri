import type Geometry from '@arcgis/core/geometry/Geometry.js';
import * as areaOperator from '@arcgis/core/geometry/operators/areaOperator.js';
import * as cutOperator from '@arcgis/core/geometry/operators/cutOperator.js';
import * as geodesicBufferOperator from '@arcgis/core/geometry/operators/geodesicBufferOperator.js';
import * as lengthOperator from '@arcgis/core/geometry/operators/lengthOperator.js';
import * as multiPartToSinglePartOperator from '@arcgis/core/geometry/operators/multiPartToSinglePartOperator.js';
import type Polygon from '@arcgis/core/geometry/Polygon.js';
import type Polyline from '@arcgis/core/geometry/Polyline.js';
import type { FeatureTable } from '@ugrc/wri-shared/types';

export const CUT_DRAFT_NOOP_ERROR = 'The cut line did not split any drafted geometry.';
export const BUFFER_DRAFT_NOOP_ERROR = 'Draw at least one line before buffering.';
export const INVALID_BUFFER_DISTANCE_ERROR = 'Choose a buffer distance of 5, 10, or 15 meters.';
export const BUFFER_DRAFT_DISTANCES = [5, 10, 15] as const;

type CuttableFeatureTable = Extract<FeatureTable, 'POLY' | 'LINE'>;
type BufferableFeatureTable = Extract<FeatureTable, 'POLY'>;
type SupportedDraftGeometry = Polygon | Polyline;

type CutDraftGeometriesParams = {
  geometries: Geometry[];
  cutGeometry: Polyline;
  table: CuttableFeatureTable;
};

type CutDraftGeometriesResult = {
  geometries: Geometry[];
  changed: boolean;
  error: string | null;
};

type BufferDraftGeometriesParams = {
  geometries: Geometry[];
  distance: number;
  table: BufferableFeatureTable;
};

const isPolygonGeometry = (geometry: Geometry): geometry is Polygon => geometry.type === 'polygon';

const isPolylineGeometry = (geometry: Geometry): geometry is Polyline => geometry.type === 'polyline';

const isSupportedBufferDistance = (distance: number): distance is (typeof BUFFER_DRAFT_DISTANCES)[number] => {
  return BUFFER_DRAFT_DISTANCES.includes(distance as (typeof BUFFER_DRAFT_DISTANCES)[number]);
};

export const canCutDraftGeometries = (table: FeatureTable | undefined, geometries: Geometry[]): boolean => {
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

export const canBufferDraftGeometries = (table: FeatureTable | undefined, geometries: Geometry[]): boolean => {
  return table === 'POLY' && geometries.some(isPolylineGeometry);
};

// areaOperator returns a signed value, so counter-clockwise rings would otherwise score lowest.
const measurePiece = (piece: SupportedDraftGeometry, table: CuttableFeatureTable): number => {
  return table === 'POLY'
    ? Math.abs(areaOperator.execute(piece as Polygon))
    : Math.abs(lengthOperator.execute(piece as Polyline));
};

export const toSinglePartDraftGeometries = (geometries: Geometry[]): Geometry[] => {
  return geometries.flatMap((geometry) => {
    if (!isPolygonGeometry(geometry) && !isPolylineGeometry(geometry)) {
      return [geometry];
    }

    return multiPartToSinglePartOperator.executeMany([geometry]) as SupportedDraftGeometry[];
  });
};

export const cutDraftGeometries = ({
  geometries,
  cutGeometry,
  table,
}: CutDraftGeometriesParams): CutDraftGeometriesResult => {
  let changed = false;

  const nextGeometries = geometries.flatMap((geometry): Geometry[] => {
    // cutOperator groups every left-side part into a single output geometry, so a multipart draft
    // has to be cut one part at a time to keep parts the cut line never touched.
    return (toSinglePartDraftGeometries([geometry]) as SupportedDraftGeometry[]).flatMap((part): Geometry[] => {
      const pieces = (cutOperator.execute(part, cutGeometry) ?? [])
        .filter((piece): piece is SupportedDraftGeometry => piece != null)
        .map((piece) => ({ piece, size: measurePiece(piece, table) }))
        .filter(({ size }) => size > 0);

      if (pieces.length < 2) {
        return [part];
      }

      changed = true;

      const survivor = pieces.reduce((best, candidate) => (candidate.size > best.size ? candidate : best));

      return [survivor.piece];
    });
  });

  if (!changed) {
    return {
      geometries,
      changed: false,
      error: CUT_DRAFT_NOOP_ERROR,
    };
  }

  return {
    geometries: nextGeometries,
    changed: true,
    error: null,
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
