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
vi.mock('./deleteFeature.js', () => ({
  deleteExtractedGis: vi.fn(),
  deletePolyActions: vi.fn(),
}));
vi.mock('./createFeature.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./createFeature.js')>();

  return {
    ...actual,
    insertExtractedGis: vi.fn(),
    insertPolyActions: vi.fn(),
  };
});
vi.mock('./extractions.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./extractions.js')>();

  return {
    ...actual,
    extractIntersections: vi.fn().mockResolvedValue({}),
    calculateAreasAndLengths: vi.fn().mockResolvedValue({ areas: [1000], lengths: [5280] }),
    projectGeometries: vi.fn().mockResolvedValue([{ spatialReference: { wkid: 26912 } }]),
    unionGeometries: vi.fn().mockResolvedValue({ spatialReference: { wkid: 26912 }, type: 'polygon' }),
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

import type { Knex } from 'knex';
import { getDb } from '../database.js';
import { canEditProject, updateProjectStats } from '../utils.js';
import { insertExtractedGis, insertPolyActions } from './createFeature.js';
import { deleteExtractedGis, deletePolyActions } from './deleteFeature.js';
import {
  extractIntersections,
  FEATURE_SERVICE_CONFIG,
  FeatureServiceQueryError,
  projectGeometries,
} from './extractions.js';
import { updateFeatureHandler, updateFeatureTransaction } from './updateFeature.js';

type RawCall = { sql: string; params: unknown[] };

const createMockTrx = ({
  overlapCount = 0,
  updateCount = 1,
  existingFeature,
}: {
  overlapCount?: number;
  updateCount?: number;
  existingFeature?: { featureId: number; typeDescription: string } | null;
} = {}) => {
  const rawCalls: RawCall[] = [];

  const makeBuilder = (tableName: string) => ({
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    whereRaw: vi.fn().mockReturnThis(),
    first: vi
      .fn()
      .mockResolvedValue(
        tableName === 'PROJECT'
          ? { status: 'Active', statusCode: 1 }
          : tableName === 'LU_FEATURETYPE'
            ? { typeCode: 1 }
            : tableName === 'LU_ACTION'
              ? { id: 10 }
              : tableName === 'LU_FEATURESUBTYPE'
                ? { id: 20 }
                : (existingFeature ?? null),
      ),
    update: vi.fn().mockResolvedValue(updateCount),
  });

  const trxFn = (tableName: string) => makeBuilder(tableName);
  const trx = Object.assign(trxFn, {
    raw: vi.fn((sql: string, params: unknown[] = []) => {
      rawCalls.push({ sql, params });

      if (sql.includes('SELECT COUNT(*) as overlap_count')) {
        return Promise.resolve([{ overlap_count: overlapCount }]);
      }

      return { sql, params };
    }),
  }) as unknown as Knex.Transaction;

  return { trx, rawCalls };
};

const validPolyActions = [
  { action: 'Herbicide Application', treatments: [{ treatment: 'Aerial (helicopter)', herbicides: ['Imazapic'] }] },
];

const validRequest = {
  projectId: 1,
  featureId: 55,
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
  retreatment: false,
  actions: validPolyActions,
  key: 'test-key',
  token: 'test-token',
};

describe('updateFeatureHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws invalid-argument when featureId is invalid', async () => {
    await expect(updateFeatureHandler({ data: { ...validRequest, featureId: 0 } } as never)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws permission-denied when canEditProject returns false', async () => {
    vi.mocked(canEditProject).mockResolvedValue(false);
    vi.mocked(getDb).mockResolvedValue({} as never);

    await expect(updateFeatureHandler({ data: validRequest } as never)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('requests stream intersections for aquatic/riparian treatment areas only', async () => {
    const { trx } = createMockTrx({
      existingFeature: { featureId: 55, typeDescription: 'aquatic/riparian treatment area' },
    });

    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({
      transaction: vi.fn(async (cb: (trx: Knex.Transaction) => Promise<unknown>) => cb(trx)),
    } as never);

    await updateFeatureHandler({
      data: { ...validRequest, featureType: 'aquatic/riparian treatment area', retreatment: true },
    } as never);

    const [, criteria] = vi.mocked(extractIntersections).mock.calls[0]!;
    expect(criteria).toEqual({
      county: { attributes: [...FEATURE_SERVICE_CONFIG.county.attributes] },
      landowner: { attributes: [...FEATURE_SERVICE_CONFIG.landowner.attributes] },
      sgma: { attributes: [...FEATURE_SERVICE_CONFIG.sgma.attributes] },
      stream: { attributes: [...FEATURE_SERVICE_CONFIG.stream.attributes] },
    });
  });

  it('maps SGMA timeout failures to a specific internal HttpsError message', async () => {
    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({
      transaction: vi.fn(async () => {
        throw new Error('transaction should not run when SGMA extraction fails');
      }),
    } as never);
    vi.mocked(projectGeometries).mockResolvedValue([{ spatialReference: { wkid: 26912 } }] as never);
    vi.mocked(extractIntersections).mockRejectedValue(
      new FeatureServiceQueryError('Failed to query sgma intersections', {
        isTimeout: true,
        layerName: 'sgma',
        serviceUrl: FEATURE_SERVICE_CONFIG.sgma.url,
      }),
    );

    await expect(updateFeatureHandler({ data: validRequest } as never)).rejects.toMatchObject({
      code: 'internal',
      message: 'Failed to update feature because the required SGMA lookup timed out.',
    });
  });
});

describe('updateFeatureTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws not-found when the target feature does not exist', async () => {
    const { trx } = createMockTrx({ existingFeature: null });

    await expect(
      updateFeatureTransaction(
        trx,
        1,
        55,
        'terrestrial treatment area',
        'POLY',
        'POLYGON((0 0, 1 0, 1 1, 0 0))',
        'N',
        validPolyActions,
        1000,
        null,
        {},
      ),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('throws invalid-argument when featureType changes', async () => {
    const { trx } = createMockTrx({ existingFeature: { featureId: 55, typeDescription: 'affected area' } });

    await expect(
      updateFeatureTransaction(
        trx,
        1,
        55,
        'terrestrial treatment area',
        'POLY',
        'POLYGON((0 0, 1 0, 1 1, 0 0))',
        'N',
        validPolyActions,
        1000,
        null,
        {},
      ),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws already-exists when POLY feature overlaps another feature', async () => {
    const { trx, rawCalls } = createMockTrx({
      overlapCount: 1,
      existingFeature: { featureId: 55, typeDescription: 'terrestrial treatment area' },
    });

    await expect(
      updateFeatureTransaction(
        trx,
        1,
        55,
        'terrestrial treatment area',
        'POLY',
        'POLYGON((0 0, 1 0, 1 1, 0 0))',
        'N',
        validPolyActions,
        1000,
        null,
        {},
      ),
    ).rejects.toMatchObject({ code: 'already-exists' });

    expect(rawCalls[0]?.sql).toContain('p.FeatureID <> ?');
  });

  it('replaces polygon actions and GIS rows and refreshes project stats', async () => {
    const { trx } = createMockTrx({
      existingFeature: { featureId: 55, typeDescription: 'terrestrial treatment area' },
    });
    vi.mocked(updateProjectStats).mockResolvedValue(undefined);

    const result = await updateFeatureTransaction(
      trx,
      1,
      55,
      'terrestrial treatment area',
      'POLY',
      'POLYGON((0 0, 1 0, 1 1, 0 0))',
      'Y',
      validPolyActions,
      1000,
      null,
      { county: [{ name: 'Cache', size: 1000 }] } as never,
    );

    expect(result).toMatchObject({ featureId: 55, statusDescription: 'Active' });
    expect(deletePolyActions).toHaveBeenCalledWith(trx, 55);
    expect(deleteExtractedGis).toHaveBeenCalledWith(trx, 55, 'POLY');
    expect(insertPolyActions).toHaveBeenCalledWith(trx, 55, validPolyActions);
    expect(insertExtractedGis).toHaveBeenCalledWith(trx, 55, 'POLY', 1, { county: [{ name: 'Cache', size: 1000 }] });
    expect(updateProjectStats).toHaveBeenCalledWith(trx, 1);
  });

  it('updates line features without polygon-specific action replacement', async () => {
    const { trx } = createMockTrx({ existingFeature: { featureId: 77, typeDescription: 'fence' } });
    vi.mocked(updateProjectStats).mockResolvedValue(undefined);

    const lineActions = [{ type: 'Barbed wire', action: 'Initial', description: 'updated' }];

    const result = await updateFeatureTransaction(
      trx,
      1,
      77,
      'fence',
      'LINE',
      'LINESTRING(0 0, 1 1)',
      'N',
      lineActions,
      null,
      5280,
      {},
    );

    expect(result).toMatchObject({ featureId: 77, statusDescription: 'Active' });
    expect(deletePolyActions).not.toHaveBeenCalled();
    expect(deleteExtractedGis).toHaveBeenCalledWith(trx, 77, 'LINE');
  });
});
