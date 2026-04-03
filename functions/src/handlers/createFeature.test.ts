import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/logger');
vi.mock('../database.js');
vi.mock('../utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils.js')>();

  return {
    ...actual,
    canEditProject: vi.fn(),
    updateProjectStats: vi.fn(),
    validateActions: vi.fn(),
  };
});
vi.mock('./extractions.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./extractions.js')>();

  return {
    ...actual,
    extractIntersections: vi.fn().mockResolvedValue({}),
    calculateAreasAndLengths: vi.fn().mockResolvedValue({}),
    projectGeometries: vi.fn().mockResolvedValue([{}]),
  };
});
vi.mock('@arcgis/core/geometry/support/jsonUtils.js', () => ({
  fromJSON: vi.fn().mockReturnValue({
    type: 'polygon',
    spatialReference: { wkid: 3857 },
    toJSON: () => ({
      rings: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    }),
  }),
}));

import { HttpsError } from 'firebase-functions/v2/https';
import type { Knex } from 'knex';
import { getDb } from '../database.js';
import { canEditProject, updateProjectStats, validateActions } from '../utils.js';
import { createFeatureHandler, createFeatureTransaction, geometryToWkt } from './createFeature.js';
import { calculateAreasAndLengths, extractIntersections, projectGeometries } from './extractions.js';

// ---------------------------------------------------------------------------
// Mock transaction builder
// ---------------------------------------------------------------------------

type InsertCall = { table: string; data: Record<string, unknown> };
type RawCall = { sql: string; params: unknown[] };

const createMockTrx = ({
  overlapCount = 0,
  featureIdPoly = 100,
  featureIdLine = 101,
  featureIdPoint = 102,
  areaActionId = 200,
  areaTreatmentId = 300,
} = {}) => {
  const insertCalls: InsertCall[] = [];
  const rawCalls: RawCall[] = [];

  const makeInsertBuilder = (tableName: string) => {
    const currentData: Record<string, unknown> = {};

    const builder = {
      insert: vi.fn((data: Record<string, unknown>) => {
        Object.assign(currentData, data);
        insertCalls.push({ table: tableName, data: { ...currentData } });
        return builder;
      }),
      returning: vi.fn((col: string) => {
        if (tableName === 'AREAACTION') return Promise.resolve([{ AreaActionId: areaActionId }]);
        if (tableName === 'AREATREATMENT') return Promise.resolve([{ AreaTreatmentID: areaTreatmentId }]);
        return Promise.resolve([{ [col]: 999 }]);
      }),
    };

    return builder;
  };

  const makeSelectBuilder = (tableName: string) => ({
    whereRaw: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    first: vi
      .fn()
      .mockResolvedValue(
        tableName === 'PROJECT'
          ? { status: 'Active' }
          : tableName === 'LU_FEATURETYPE'
            ? { typeCode: 1 }
            : tableName === 'LU_ACTION'
              ? { id: 10 }
              : tableName === 'LU_FEATURESUBTYPE'
                ? { id: 20 }
                : tableName === 'LU_TREATMENTTYPE'
                  ? { TreatmentTypeID: 30 }
                  : tableName === 'LU_HERBICIDE'
                    ? { HerbicideID: 40 }
                    : null,
      ),
  });

  const trxFn = (tableName: string) => {
    const hasInsert = [
      'AREAACTION',
      'AREATREATMENT',
      'AREAHERBICIDE',
      'COUNTY',
      'LANDOWNER',
      'SGMA',
      'STREAM',
    ].includes(tableName);

    return hasInsert ? makeInsertBuilder(tableName) : makeSelectBuilder(tableName);
  };

  const trx = Object.assign(trxFn, {
    raw: vi.fn((sql: string, params: unknown[] = []) => {
      rawCalls.push({ sql, params });

      if (sql.includes('STRelate')) {
        return Promise.resolve([{ overlap_count: overlapCount }]);
      }

      if (sql.includes('[dbo].[POLY]')) {
        return Promise.resolve([{ FeatureID: featureIdPoly }]);
      }

      if (sql.includes('[dbo].[LINE]')) {
        return Promise.resolve([{ FeatureID: featureIdLine }]);
      }

      if (sql.includes('[dbo].[POINT]')) {
        return Promise.resolve([{ FeatureID: featureIdPoint }]);
      }

      return Promise.resolve([]);
    }),
  }) as unknown as Knex.Transaction;

  return { trx, insertCalls, rawCalls };
};

const mockEmptyIntersections = {};

const validPolyActions = [
  { action: 'Herbicide Application', treatments: [{ treatment: 'Aerial (helicopter)', herbicides: [] }] },
];

const validPointAction = [{ type: 'Horizontal', action: 'Initial', description: '' }];
const validLineAction = [{ type: 'Barbed wire', action: 'Initial', description: '' }];

// ---------------------------------------------------------------------------
// Handler-level tests (input validation + auth)
// ---------------------------------------------------------------------------

describe('createFeatureHandler', () => {
  const validPolyData = {
    projectId: 1,
    featureType: 'terrestrial treatment area',
    geometry: {
      type: 'polygon',
      rings: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
    retreatment: 'N',
    actions: validPolyActions,
    key: 'test-key',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws invalid-argument when data is missing', async () => {
    await expect(createFeatureHandler({ data: null } as never)).rejects.toThrow(HttpsError);
  });

  it('throws invalid-argument for a non-numeric projectId', async () => {
    await expect(createFeatureHandler({ data: { ...validPolyData, projectId: 'abc' } } as never)).rejects.toMatchObject(
      { code: 'invalid-argument' },
    );
  });

  it('throws invalid-argument for projectId <= 0', async () => {
    await expect(createFeatureHandler({ data: { ...validPolyData, projectId: 0 } } as never)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws invalid-argument for an unknown featureType', async () => {
    await expect(
      createFeatureHandler({ data: { ...validPolyData, featureType: 'unknown type' } } as never),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when geometry is missing', async () => {
    await expect(createFeatureHandler({ data: { ...validPolyData, geometry: null } } as never)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws permission-denied when canEditProject returns false', async () => {
    vi.mocked(canEditProject).mockResolvedValue(false);
    vi.mocked(getDb).mockResolvedValue({} as never);

    await expect(createFeatureHandler({ data: validPolyData } as never)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('normalizes featureType to lowercase before lookup', async () => {
    const { trx } = createMockTrx();
    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({
      transaction: vi.fn(async (cb: (trx: Knex.Transaction) => Promise<unknown>) => cb(trx)),
    } as never);
    vi.mocked(calculateAreasAndLengths).mockResolvedValue({ areas: [1000] });
    vi.mocked(projectGeometries).mockResolvedValue([{}] as never);
    vi.mocked(extractIntersections).mockResolvedValue(mockEmptyIntersections);

    const result = await createFeatureHandler({
      data: { ...validPolyData, featureType: 'Terrestrial Treatment Area' },
    } as never);

    expect(result).toMatchObject({ featureId: 100 });
  });

  it('wraps unexpected errors in an internal HttpsError', async () => {
    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({
      transaction: vi.fn(async () => {
        throw new Error('unexpected DB error');
      }),
    } as never);
    vi.mocked(projectGeometries).mockResolvedValue([{}] as never);
    vi.mocked(extractIntersections).mockResolvedValue(mockEmptyIntersections);

    await expect(createFeatureHandler({ data: validPolyData } as never)).rejects.toMatchObject({ code: 'internal' });
  });
});

// ---------------------------------------------------------------------------
// Transaction-level tests
// ---------------------------------------------------------------------------

describe('createFeatureTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws already-exists when POLY feature overlaps existing', async () => {
    const { trx } = createMockTrx({ overlapCount: 1 });

    await expect(
      createFeatureTransaction(
        trx,
        1,
        'terrestrial treatment area',
        'POLY',
        'POLYGON((0 0, 1 0, 1 1, 0 0))',
        'N',
        validPolyActions,
        1000,
        null,
        mockEmptyIntersections,
      ),
    ).rejects.toMatchObject({ code: 'already-exists' });
  });

  it('inserts a POLY feature and returns the featureId', async () => {
    const { trx, rawCalls } = createMockTrx({ featureIdPoly: 42 });
    vi.mocked(updateProjectStats).mockResolvedValue(undefined);

    const { featureId } = await createFeatureTransaction(
      trx,
      1,
      'terrestrial treatment area',
      'POLY',
      'POLYGON((0 0, 1 0, 1 1, 0 0))',
      'N',
      validPolyActions,
      1000,
      null,
      mockEmptyIntersections,
    );

    expect(featureId).toBe(42);
    expect(rawCalls.some((c) => c.sql.includes('[dbo].[POLY]'))).toBe(true);
  });

  it('inserts a LINE feature and returns the featureId', async () => {
    const { trx } = createMockTrx({ featureIdLine: 55 });
    vi.mocked(updateProjectStats).mockResolvedValue(undefined);

    const { featureId } = await createFeatureTransaction(
      trx,
      1,
      'fence',
      'LINE',
      'LINESTRING(0 0, 1 1)',
      'N',
      validLineAction,
      null,
      500,
      mockEmptyIntersections,
    );

    expect(featureId).toBe(55);
  });

  it('inserts a POINT feature and returns the featureId', async () => {
    const { trx } = createMockTrx({ featureIdPoint: 77 });
    vi.mocked(updateProjectStats).mockResolvedValue(undefined);

    const { featureId } = await createFeatureTransaction(
      trx,
      1,
      'guzzler',
      'POINT',
      'POINT(0 0)',
      'N',
      validPointAction,
      null,
      null,
      mockEmptyIntersections,
    );

    expect(featureId).toBe(77);
  });

  it('calls updateProjectStats after inserting', async () => {
    const { trx } = createMockTrx();
    vi.mocked(updateProjectStats).mockResolvedValue(undefined);

    await createFeatureTransaction(
      trx,
      1,
      'terrestrial treatment area',
      'POLY',
      'POLYGON((0 0, 1 0, 1 1, 0 0))',
      'N',
      validPolyActions,
      1000,
      null,
      mockEmptyIntersections,
    );

    expect(updateProjectStats).toHaveBeenCalledWith(trx, 1);
  });

  it('inserts AREAACTION rows for poly actions', async () => {
    const { trx, insertCalls } = createMockTrx();
    vi.mocked(updateProjectStats).mockResolvedValue(undefined);

    await createFeatureTransaction(
      trx,
      1,
      'terrestrial treatment area',
      'POLY',
      'POLYGON((0 0, 1 0, 1 1, 0 0))',
      'N',
      validPolyActions,
      1000,
      null,
      mockEmptyIntersections,
    );

    const actionInserts = insertCalls.filter((c) => c.table === 'AREAACTION');
    expect(actionInserts).toHaveLength(1);
    expect(actionInserts[0]!.data.ActionDescription).toBe('Herbicide Application');
  });

  it('inserts GIS rollup rows for county intersections', async () => {
    const { trx, rawCalls } = createMockTrx();
    vi.mocked(updateProjectStats).mockResolvedValue(undefined);

    await createFeatureTransaction(
      trx,
      1,
      'terrestrial treatment area',
      'POLY',
      'POLYGON((0 0, 1 0, 1 1, 0 0))',
      'N',
      validPolyActions,
      1000,
      null,
      { county: [{ name: 'Salt Lake', size: 500, displaySize: '500 sqm' }] } as never,
    );

    const countyRawCalls = rawCalls.filter((c) => c.sql.includes('[dbo].[COUNTY]'));
    expect(countyRawCalls).toHaveLength(1);
    expect(countyRawCalls[0]!.params).toContain('Salt Lake');
  });

  it('does not insert STREAM rows for LINE features', async () => {
    const { trx, insertCalls } = createMockTrx();
    vi.mocked(updateProjectStats).mockResolvedValue(undefined);

    await createFeatureTransaction(trx, 1, 'fence', 'LINE', 'LINESTRING(0 0, 1 1)', 'N', validLineAction, null, 500, {
      stream: [{ fcode_text: 'Perennial', size: 100, displaySize: '100 m' }],
    } as never);

    const streamInserts = insertCalls.filter((c) => c.table === 'STREAM');
    expect(streamInserts).toHaveLength(0);
  });

  it('inserts STREAM rows for POLY features', async () => {
    const { trx, insertCalls } = createMockTrx();
    vi.mocked(updateProjectStats).mockResolvedValue(undefined);

    await createFeatureTransaction(
      trx,
      1,
      'terrestrial treatment area',
      'POLY',
      'POLYGON((0 0, 1 0, 1 1, 0 0))',
      'N',
      validPolyActions,
      1000,
      null,
      { stream: [{ fcode_text: 'Perennial', size: 100, displaySize: '100 m' }] } as never,
    );

    const streamInserts = insertCalls.filter((c) => c.table === 'STREAM');
    expect(streamInserts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// validateActions error propagation
// ---------------------------------------------------------------------------

describe('validateActions error propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-throws invalid-argument HttpsError from validateActions', async () => {
    vi.mocked(validateActions).mockImplementation(() => {
      throw new HttpsError('invalid-argument', 'Mock: actions invalid');
    });
    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({} as never);

    await expect(
      createFeatureHandler({
        data: {
          projectId: 1,
          featureType: 'terrestrial treatment area',
          geometry: { type: 'polygon' },
          actions: [],
          key: 'k',
          token: 't',
        },
      } as never),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

// ---------------------------------------------------------------------------
// geometryToWkt unit tests
// ---------------------------------------------------------------------------

describe('geometryToWkt', () => {
  it('converts a multipoint geometry to WKT', () => {
    const geometry = {
      toJSON: () => ({
        points: [
          [1, 2],
          [3, 4],
        ],
      }),
    } as never;
    expect(geometryToWkt(geometry)).toBe('MULTIPOINT ((1 2), (3 4))');
  });

  it('converts a single-path polyline to LINESTRING WKT', () => {
    const geometry = {
      toJSON: () => ({
        paths: [
          [
            [0, 0],
            [1, 1],
            [2, 0],
          ],
        ],
      }),
    } as never;
    expect(geometryToWkt(geometry)).toBe('LINESTRING (0 0, 1 1, 2 0)');
  });

  it('converts a multi-path polyline to MULTILINESTRING WKT', () => {
    const geometry = {
      toJSON: () => ({
        paths: [
          [
            [0, 0],
            [1, 1],
          ],
          [
            [2, 2],
            [3, 3],
          ],
        ],
      }),
    } as never;
    expect(geometryToWkt(geometry)).toBe('MULTILINESTRING ((0 0, 1 1), (2 2, 3 3))');
  });

  it('converts a polygon with one ring to POLYGON WKT', () => {
    const geometry = {
      toJSON: () => ({
        rings: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      }),
    } as never;
    expect(geometryToWkt(geometry)).toBe('POLYGON ((0 0, 1 0, 1 1, 0 0))');
  });

  it('converts a polygon with multiple rings to POLYGON WKT', () => {
    const geometry = {
      toJSON: () => ({
        rings: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 0],
          ],
          [
            [1, 1],
            [2, 1],
            [2, 2],
            [1, 1],
          ],
        ],
      }),
    } as never;
    expect(geometryToWkt(geometry)).toBe('POLYGON ((0 0, 4 0, 4 4, 0 0), (1 1, 2 1, 2 2, 1 1))');
  });

  it('throws HttpsError for unsupported geometry type', () => {
    const geometry = { toJSON: () => ({ x: 1, y: 2 }) } as never;
    expect(() => geometryToWkt(geometry)).toThrow(HttpsError);
  });
});
