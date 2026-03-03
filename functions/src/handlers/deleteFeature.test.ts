import { beforeEach, describe, expect, it, vi } from 'vitest';

// Must be hoisted before any module imports that use them
vi.mock('firebase-functions/logger');
vi.mock('../database.js');
vi.mock('../utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils.js')>();

  return {
    ...actual,
    canEditProject: vi.fn(),
    updateProjectStats: vi.fn(),
  };
});

import { HttpsError } from 'firebase-functions/v2/https';
import type { Knex } from 'knex';
import { getDb } from '../database.js';
import { canEditProject, updateProjectStats } from '../utils.js';
import { deleteFeatureHandler, deleteFeatureTransaction } from './deleteFeature.js';

// ---------------------------------------------------------------------------
// Mock transaction builder
// ---------------------------------------------------------------------------

type DeleteCall = {
  table: string;
  where?: Record<string, unknown>;
  whereIn?: Record<string, unknown[]>;
  hasWhereRaw?: boolean;
};

/**
 * Creates a minimal Knex.Transaction mock that records delete operations and
 * raw SQL calls so tests can assert on what was executed.
 *
 * `featureDeleteReturn` controls the row count returned by `delete()` on the
 * primary feature tables (POLY, LINE, POINT). Set it to `0` to simulate a
 * feature that does not exist in the given project (cross-project ownership
 * check).
 */
const createMockTrx = ({
  areaActions = [] as { AreaActionId: number }[],
  areaTreatments = [] as { AreaTreatmentID: number }[],
  featureDeleteReturn = 1,
} = {}) => {
  const deleteCalls: DeleteCall[] = [];
  const rawCalls: string[] = [];

  const makeTableBuilder = (tableName: string) => {
    const currentCall: DeleteCall = { table: tableName };
    const isFeatureTable = ['POLY', 'LINE', 'POINT'].includes(tableName);

    const builder = {
      where(col: string, val: unknown) {
        currentCall.where = { ...currentCall.where, [col]: val };
        return builder;
      },
      andWhere(col: string, val: unknown) {
        currentCall.where = { ...currentCall.where, [col]: val };
        return builder;
      },
      whereIn(col: string, vals: unknown[]) {
        currentCall.whereIn = { ...currentCall.whereIn, [col]: vals };
        return builder;
      },
      whereRaw() {
        currentCall.hasWhereRaw = true;
        return builder;
      },
      delete: vi.fn(async () => {
        deleteCalls.push({ ...currentCall });
        return isFeatureTable ? featureDeleteReturn : 1;
      }),
    };

    return builder;
  };

  const trxFn = (tableName: string) => makeTableBuilder(tableName);

  const trx = Object.assign(trxFn, {
    select: () => ({
      from: (tableName: string) => ({
        where: () => Promise.resolve(tableName === 'AREAACTION' ? areaActions : []),
        whereIn: () => Promise.resolve(tableName === 'AREATREATMENT' ? areaTreatments : []),
      }),
    }),
    raw: vi.fn(async (sql: string) => {
      rawCalls.push(sql);
    }),
  }) as unknown as Knex.Transaction;

  return { trx, deleteCalls, rawCalls };
};

// ---------------------------------------------------------------------------
// Handler-level tests (input validation + auth)
// ---------------------------------------------------------------------------

describe('deleteFeatureHandler', () => {
  const validData = {
    projectId: 1,
    featureId: 42,
    featureType: 'fence',
    key: 'test-key',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws invalid-argument when data is missing', async () => {
    await expect(deleteFeatureHandler({ data: null } as never)).rejects.toThrow(HttpsError);
  });

  it('throws invalid-argument for a non-numeric projectId', async () => {
    await expect(deleteFeatureHandler({ data: { ...validData, projectId: 'abc' } } as never)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws invalid-argument for projectId <= 0', async () => {
    await expect(deleteFeatureHandler({ data: { ...validData, projectId: 0 } } as never)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    await expect(deleteFeatureHandler({ data: { ...validData, projectId: -5 } } as never)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws invalid-argument for a non-numeric featureId', async () => {
    await expect(deleteFeatureHandler({ data: { ...validData, featureId: 'abc' } } as never)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws invalid-argument for featureId <= 0', async () => {
    await expect(deleteFeatureHandler({ data: { ...validData, featureId: 0 } } as never)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws invalid-argument for an unknown featureType', async () => {
    await expect(
      deleteFeatureHandler({ data: { ...validData, featureType: 'unknown-type' } } as never),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('normalizes featureType to lowercase before lookup', async () => {
    // 'Fence' (mixed case) should resolve to LINE without invalid-argument
    const { trx } = createMockTrx();
    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({
      transaction: vi.fn(async (cb: (trx: Knex.Transaction) => Promise<void>) => cb(trx)),
    } as never);

    await expect(
      deleteFeatureHandler({ data: { ...validData, featureType: 'Fence' } } as never),
    ).resolves.toMatchObject({ message: 'Feature deleted successfully.' });
  });

  it('throws permission-denied when canEditProject returns false', async () => {
    vi.mocked(canEditProject).mockResolvedValue(false);
    vi.mocked(getDb).mockResolvedValue({} as never);

    await expect(deleteFeatureHandler({ data: validData } as never)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('returns a success message when the operation completes', async () => {
    const { trx } = createMockTrx();
    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({
      transaction: vi.fn(async (cb: (trx: Knex.Transaction) => Promise<void>) => cb(trx)),
    } as never);

    const result = await deleteFeatureHandler({ data: validData } as never);

    expect(result).toEqual({ message: 'Feature deleted successfully.' });
  });

  it('wraps unexpected errors in an internal HttpsError', async () => {
    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({
      transaction: vi.fn(async () => {
        throw new Error('unexpected DB error');
      }),
    } as never);

    await expect(deleteFeatureHandler({ data: validData } as never)).rejects.toMatchObject({
      code: 'internal',
    });
  });
});

// ---------------------------------------------------------------------------
// Transaction-level tests (delete operations + project stats)
// ---------------------------------------------------------------------------

describe('deleteFeatureTransaction', () => {
  const projectId = 99;
  const featureId = 42;

  describe('POLY feature with actions and treatments', () => {
    it('cascade-deletes AREAHERBICIDE → AREATREATMENT → AREAACTION', async () => {
      const { trx, deleteCalls } = createMockTrx({
        areaActions: [{ AreaActionId: 1 }, { AreaActionId: 2 }],
        areaTreatments: [{ AreaTreatmentID: 10 }, { AreaTreatmentID: 11 }],
      });

      await deleteFeatureTransaction(trx, projectId, featureId, 'terrestrial treatment area', 'POLY');

      const deletedTables = deleteCalls.map((c) => c.table);

      expect(deletedTables).toContain('AREAHERBICIDE');
      expect(deletedTables).toContain('AREATREATMENT');
      expect(deletedTables).toContain('AREAACTION');

      // AREAHERBICIDE must be deleted before AREATREATMENT
      expect(deletedTables.indexOf('AREAHERBICIDE')).toBeLessThan(deletedTables.indexOf('AREATREATMENT'));
    });

    it('deletes AREAHERBICIDE and AREATREATMENT with the correct treatment IDs', async () => {
      const { trx, deleteCalls } = createMockTrx({
        areaActions: [{ AreaActionId: 1 }],
        areaTreatments: [{ AreaTreatmentID: 10 }, { AreaTreatmentID: 11 }],
      });

      await deleteFeatureTransaction(trx, projectId, featureId, 'terrestrial treatment area', 'POLY');

      const herbicideCall = deleteCalls.find((c) => c.table === 'AREAHERBICIDE');
      const treatmentCall = deleteCalls.find((c) => c.table === 'AREATREATMENT');

      expect(herbicideCall?.whereIn).toEqual({ AreaTreatmentID: [10, 11] });
      expect(treatmentCall?.whereIn).toEqual({ AreaTreatmentID: [10, 11] });
    });
  });

  describe('POLY feature with actions but no treatments', () => {
    it('deletes AREAACTION but skips AREAHERBICIDE and AREATREATMENT', async () => {
      const { trx, deleteCalls } = createMockTrx({
        areaActions: [{ AreaActionId: 5 }],
        areaTreatments: [],
      });

      await deleteFeatureTransaction(trx, projectId, featureId, 'terrestrial treatment area', 'POLY');

      const deletedTables = deleteCalls.map((c) => c.table);

      expect(deletedTables).toContain('AREAACTION');
      expect(deletedTables).not.toContain('AREAHERBICIDE');
      expect(deletedTables).not.toContain('AREATREATMENT');
    });
  });

  describe('POLY feature with no actions', () => {
    it('skips the entire action cascade', async () => {
      const { trx, deleteCalls } = createMockTrx({ areaActions: [], areaTreatments: [] });

      await deleteFeatureTransaction(trx, projectId, featureId, 'terrestrial treatment area', 'POLY');

      const deletedTables = deleteCalls.map((c) => c.table);

      expect(deletedTables).not.toContain('AREAACTION');
      expect(deletedTables).not.toContain('AREATREATMENT');
      expect(deletedTables).not.toContain('AREAHERBICIDE');
    });
  });

  describe('POLY feature — rollup and spatial row cleanup', () => {
    it('deletes COUNTY, LANDOWNER, SGMA with FeatureClass = POLY', async () => {
      const { trx, deleteCalls } = createMockTrx();

      await deleteFeatureTransaction(trx, projectId, featureId, 'terrestrial treatment area', 'POLY');

      for (const rollupTable of ['COUNTY', 'LANDOWNER', 'SGMA']) {
        const call = deleteCalls.find((c) => c.table === rollupTable);

        expect(call?.where).toMatchObject({ FeatureID: featureId, FeatureClass: 'POLY' });
      }
    });

    it('deletes from STREAM for POLY features', async () => {
      const { trx, deleteCalls } = createMockTrx();

      await deleteFeatureTransaction(trx, projectId, featureId, 'terrestrial treatment area', 'POLY');

      const streamCall = deleteCalls.find((c) => c.table === 'STREAM');

      expect(streamCall?.where).toMatchObject({ FeatureID: featureId });
    });

    it('deletes the POLY spatial row using FeatureID, Project_ID, and a raw TypeDescription check', async () => {
      const { trx, deleteCalls } = createMockTrx();

      await deleteFeatureTransaction(trx, projectId, featureId, 'terrestrial treatment area', 'POLY');

      const polyCall = deleteCalls.find((c) => c.table === 'POLY');

      expect(polyCall?.where).toMatchObject({ FeatureID: featureId, Project_ID: projectId });
      expect(polyCall?.hasWhereRaw).toBe(true);
    });
  });

  describe('LINE feature', () => {
    it('skips action cascade and STREAM deletion', async () => {
      const { trx, deleteCalls } = createMockTrx();

      await deleteFeatureTransaction(trx, projectId, featureId, 'fence', 'LINE');

      const deletedTables = deleteCalls.map((c) => c.table);

      expect(deletedTables).not.toContain('AREAACTION');
      expect(deletedTables).not.toContain('AREATREATMENT');
      expect(deletedTables).not.toContain('AREAHERBICIDE');
      expect(deletedTables).not.toContain('STREAM');
    });

    it('deletes COUNTY, LANDOWNER, SGMA with FeatureClass = LINE', async () => {
      const { trx, deleteCalls } = createMockTrx();

      await deleteFeatureTransaction(trx, projectId, featureId, 'fence', 'LINE');

      for (const rollupTable of ['COUNTY', 'LANDOWNER', 'SGMA']) {
        const call = deleteCalls.find((c) => c.table === rollupTable);

        expect(call?.where).toMatchObject({ FeatureID: featureId, FeatureClass: 'LINE' });
      }
    });

    it('deletes the LINE spatial row scoped to the project', async () => {
      const { trx, deleteCalls } = createMockTrx();

      await deleteFeatureTransaction(trx, projectId, featureId, 'fence', 'LINE');

      const lineCall = deleteCalls.find((c) => c.table === 'LINE');

      expect(lineCall?.where).toMatchObject({ FeatureID: featureId, Project_ID: projectId });
    });
  });

  describe('POINT feature', () => {
    it('skips action cascade and STREAM deletion', async () => {
      const { trx, deleteCalls } = createMockTrx();

      await deleteFeatureTransaction(trx, projectId, featureId, 'guzzler', 'POINT');

      const deletedTables = deleteCalls.map((c) => c.table);

      expect(deletedTables).not.toContain('AREAACTION');
      expect(deletedTables).not.toContain('STREAM');
    });

    it('deletes COUNTY, LANDOWNER, SGMA with FeatureClass = POINT', async () => {
      const { trx, deleteCalls } = createMockTrx();

      await deleteFeatureTransaction(trx, projectId, featureId, 'guzzler', 'POINT');

      for (const rollupTable of ['COUNTY', 'LANDOWNER', 'SGMA']) {
        const call = deleteCalls.find((c) => c.table === rollupTable);

        expect(call?.where).toMatchObject({ FeatureID: featureId, FeatureClass: 'POINT' });
      }
    });
  });

  describe('project stats update', () => {
    it('calls updateProjectStats with the correct trx and projectId', async () => {
      vi.clearAllMocks();
      const { trx } = createMockTrx();

      await deleteFeatureTransaction(trx, projectId, featureId, 'fence', 'LINE');

      expect(updateProjectStats).toHaveBeenCalledOnce();
      expect(updateProjectStats).toHaveBeenCalledWith(trx, projectId);
    });
  });

  describe('cross-project ownership check', () => {
    it('throws not-found when the feature does not belong to the project', async () => {
      const { trx } = createMockTrx({ featureDeleteReturn: 0 });

      await expect(deleteFeatureTransaction(trx, projectId, featureId, 'fence', 'LINE')).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    it('does not call updateProjectStats when the feature does not belong to the project', async () => {
      vi.clearAllMocks();
      const { trx } = createMockTrx({ featureDeleteReturn: 0 });

      await expect(deleteFeatureTransaction(trx, projectId, featureId, 'fence', 'LINE')).rejects.toMatchObject({
        code: 'not-found',
      });

      expect(updateProjectStats).not.toHaveBeenCalled();
    });

    it('throws not-found for POLY features that do not belong to the project', async () => {
      const { trx } = createMockTrx({ featureDeleteReturn: 0 });

      await expect(
        deleteFeatureTransaction(trx, projectId, featureId, 'terrestrial treatment area', 'POLY'),
      ).rejects.toMatchObject({ code: 'not-found' });
    });
  });
});
