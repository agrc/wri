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
import { getDb } from '../database.js';
import { canEditProject, updateProjectStats } from '../utils.js';
import { updateProjectStatsHandler } from './updateProjectStats.js';

describe('updateProjectStatsHandler', () => {
  const validData = {
    projectId: 1,
    key: 'test-key',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws invalid-argument when data is missing', async () => {
    await expect(updateProjectStatsHandler({ data: null } as never)).rejects.toThrow(HttpsError);
  });

  it('throws invalid-argument for a non-numeric projectId', async () => {
    await expect(
      updateProjectStatsHandler({ data: { ...validData, projectId: 'abc' } } as never),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument for projectId <= 0', async () => {
    await expect(updateProjectStatsHandler({ data: { ...validData, projectId: 0 } } as never)).rejects.toMatchObject({
      code: 'invalid-argument',
    });

    await expect(updateProjectStatsHandler({ data: { ...validData, projectId: -5 } } as never)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws permission-denied when canEditProject returns false', async () => {
    vi.mocked(canEditProject).mockResolvedValue(false);
    vi.mocked(getDb).mockResolvedValue({} as never);

    await expect(updateProjectStatsHandler({ data: validData } as never)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('returns a success message when the operation completes', async () => {
    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({
      transaction: vi.fn(async (cb: (trx: never) => Promise<void>) => cb({} as never)),
    } as never);

    const result = await updateProjectStatsHandler({ data: validData } as never);

    expect(result).toEqual({ message: 'Project statistics updated successfully.' });
    expect(updateProjectStats).toHaveBeenCalledWith({}, validData.projectId);
  });

  it('wraps unexpected errors in an internal HttpsError', async () => {
    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({
      transaction: vi.fn(async () => {
        throw new Error('unexpected DB error');
      }),
    } as never);

    await expect(updateProjectStatsHandler({ data: validData } as never)).rejects.toMatchObject({
      code: 'internal',
    });
  });

  it('re-throws an existing HttpsError without wrapping', async () => {
    vi.mocked(canEditProject).mockResolvedValue(true);
    vi.mocked(getDb).mockResolvedValue({
      transaction: vi.fn(async () => {
        throw new HttpsError('not-found', 'project not found');
      }),
    } as never);

    const error = await updateProjectStatsHandler({ data: validData } as never).catch((e) => e);

    expect(error).toBeInstanceOf(HttpsError);
    expect(error.code).toBe('not-found');
  });
});
