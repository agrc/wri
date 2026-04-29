import Polygon from '@arcgis/core/geometry/Polygon.js';
import Polyline from '@arcgis/core/geometry/Polyline.js';
import SpatialReference from '@arcgis/core/geometry/SpatialReference.js';
import { describe, expect, it } from 'vitest';
import {
  BUFFER_DRAFT_NOOP_ERROR,
  bufferDraftGeometries,
  canBufferDraftGeometries,
  canCutDraftGeometries,
  CUT_DRAFT_NOOP_ERROR,
  cutDraftGeometries,
  INVALID_BUFFER_DISTANCE_ERROR,
} from './addFeatureDraftGeometry';

const SR = new SpatialReference({ wkid: 26912 });
const GEO_SR = new SpatialReference({ wkid: 4326 });

const createPolygon = (xmin: number, ymin: number, xmax: number, ymax: number) => {
  return new Polygon({
    rings: [
      [
        [xmin, ymin],
        [xmax, ymin],
        [xmax, ymax],
        [xmin, ymax],
        [xmin, ymin],
      ],
    ],
    spatialReference: SR,
  });
};

const createHorizontalLine = (xmin: number, xmax: number, y = 0) => {
  return new Polyline({
    paths: [
      [
        [xmin, y],
        [xmax, y],
      ],
    ],
    spatialReference: SR,
  });
};

const createGeoLine = (start: [number, number], end: [number, number]) => {
  return new Polyline({
    paths: [[start, end]],
    spatialReference: GEO_SR,
  });
};

const verticalCut = new Polyline({
  paths: [
    [
      [6, -5],
      [6, 10],
    ],
  ],
  spatialReference: SR,
});

describe('addFeatureDraftGeometry helpers', () => {
  it('only allows cutting when there is draft geometry for a line or polygon', () => {
    expect(canCutDraftGeometries('POINT', [])).toBe(false);
    expect(canCutDraftGeometries('POLY', [])).toBe(false);
    expect(canCutDraftGeometries('POLY', [createHorizontalLine(0, 10)])).toBe(false);
    expect(canCutDraftGeometries('LINE', [createHorizontalLine(0, 10)])).toBe(true);
  });

  it('only allows buffering for polygon features with drafted lines', () => {
    expect(canBufferDraftGeometries('POLY', [])).toBe(false);
    expect(canBufferDraftGeometries('LINE', [createGeoLine([-111.9, 40.7], [-111.89, 40.7])])).toBe(false);
    expect(canBufferDraftGeometries('POLY', [createPolygon(0, 0, 10, 4)])).toBe(false);
    expect(canBufferDraftGeometries('POLY', [createGeoLine([-111.9, 40.7], [-111.89, 40.7])])).toBe(true);
  });

  it('keeps the largest polygon piece after a cut', async () => {
    const polygon = createPolygon(0, 0, 10, 4);

    const result = await cutDraftGeometries({
      geometries: [polygon],
      cutGeometry: verticalCut,
      table: 'POLY',
    });

    const survivingPolygon = result.geometries[0] as Polygon;
    const [ring] = survivingPolygon.rings;
    const xValues = (ring?.map(([x]) => x) ?? []).filter((value): value is number => value != null);

    expect(result.changed).toBe(true);
    expect(result.error).toBeNull();
    expect(xValues.length).toBeGreaterThan(0);
    expect(Math.min(...xValues)).toBe(0);
    expect(Math.max(...xValues)).toBe(6);
  });

  it('keeps the longest line segment after a cut', async () => {
    const line = createHorizontalLine(0, 10);

    const result = await cutDraftGeometries({
      geometries: [line],
      cutGeometry: verticalCut,
      table: 'LINE',
    });

    const survivingLine = result.geometries[0] as Polyline;
    const [path] = survivingLine.paths;
    const xValues = (path?.map(([x]) => x) ?? []).filter((value): value is number => value != null);

    expect(result.changed).toBe(true);
    expect(result.error).toBeNull();
    expect(xValues.length).toBeGreaterThan(0);
    expect(Math.min(...xValues)).toBe(0);
    expect(Math.max(...xValues)).toBe(6);
  });

  it('preserves untouched draft parts when only one part is cut', async () => {
    const intersectedPolygon = createPolygon(0, 0, 10, 4);
    const untouchedPolygon = createPolygon(20, 0, 30, 4);

    const result = await cutDraftGeometries({
      geometries: [intersectedPolygon, untouchedPolygon],
      cutGeometry: verticalCut,
      table: 'POLY',
    });

    expect(result.changed).toBe(true);
    expect((result.geometries[1] as Polygon).toJSON()).toEqual(untouchedPolygon.toJSON());
  });

  it('returns a no-op result when the cut does not split any draft geometry', async () => {
    const polygon = createPolygon(0, 0, 4, 4);
    const outsideCut = new Polyline({
      paths: [
        [
          [10, -5],
          [10, 10],
        ],
      ],
      spatialReference: SR,
    });

    const result = await cutDraftGeometries({
      geometries: [polygon],
      cutGeometry: outsideCut,
      table: 'POLY',
    });

    expect(result.changed).toBe(false);
    expect(result.error).toBe(CUT_DRAFT_NOOP_ERROR);
    expect((result.geometries[0] as Polygon).toJSON()).toEqual(polygon.toJSON());
  });

  it('buffers drafted lines into polygon geometry for POLY features', async () => {
    const draftedLine = createGeoLine([-111.9, 40.7], [-111.89, 40.7]);

    const result = await bufferDraftGeometries({
      geometries: [draftedLine],
      distance: 5,
      table: 'POLY',
    });

    const bufferedPolygon = result.geometries[0] as Polygon;
    const extent = bufferedPolygon.extent;

    expect(result.changed).toBe(true);
    expect(result.error).toBeNull();
    expect(result.geometries).toHaveLength(1);
    expect(bufferedPolygon.type).toBe('polygon');
    expect(extent).toBeTruthy();
    expect(extent!.xmin).toBeLessThan(-111.9);
    expect(extent!.xmax).toBeGreaterThan(-111.89);
  });

  it('merges multiple buffered draft lines into one polygon result', async () => {
    const firstLine = createGeoLine([-111.9, 40.7], [-111.895, 40.7]);
    const secondLine = createGeoLine([-111.895, 40.7], [-111.89, 40.7]);

    const result = await bufferDraftGeometries({
      geometries: [firstLine, secondLine],
      distance: 10,
      table: 'POLY',
    });

    expect(result.changed).toBe(true);
    expect(result.error).toBeNull();
    expect(result.geometries).toHaveLength(1);
    expect(result.geometries[0]?.type).toBe('polygon');
  });

  it('preserves existing polygon drafts while buffering new lines', async () => {
    const existingPolygon = createPolygon(0, 0, 10, 4);
    const draftedLine = createGeoLine([-111.9, 40.7], [-111.89, 40.7]);

    const result = await bufferDraftGeometries({
      geometries: [existingPolygon, draftedLine],
      distance: 15,
      table: 'POLY',
    });

    expect(result.changed).toBe(true);
    expect(result.error).toBeNull();
    expect(result.geometries).toHaveLength(2);
    expect((result.geometries[0] as Polygon).toJSON()).toEqual(existingPolygon.toJSON());
    expect(result.geometries[1]?.type).toBe('polygon');
  });

  it('rejects unsupported buffer distances', async () => {
    const draftedLine = createGeoLine([-111.9, 40.7], [-111.89, 40.7]);

    const result = await bufferDraftGeometries({
      geometries: [draftedLine],
      distance: 7,
      table: 'POLY',
    });

    expect(result.changed).toBe(false);
    expect(result.error).toBe(INVALID_BUFFER_DISTANCE_ERROR);
    expect((result.geometries[0] as Polyline).toJSON()).toEqual(draftedLine.toJSON());
  });

  it('returns a no-op result when there are no drafted lines to buffer', async () => {
    const polygon = createPolygon(0, 0, 4, 4);

    const result = await bufferDraftGeometries({
      geometries: [polygon],
      distance: 5,
      table: 'POLY',
    });

    expect(result.changed).toBe(false);
    expect(result.error).toBe(BUFFER_DRAFT_NOOP_ERROR);
    expect((result.geometries[0] as Polygon).toJSON()).toEqual(polygon.toJSON());
  });
});
