import { HttpsError } from 'firebase-functions/v2/https';
import type { Knex } from 'knex';
import { describe, expect, it } from 'vitest';
import {
  booleanToRetreatment,
  canEditProject,
  isRetreatmentEligibleFeatureType,
  parseRetreatmentInput,
  retreatmentToBoolean,
  validateActions,
  validateRetreatment,
} from './utils.js';

describe('retreatment helpers', () => {
  it('only allows retreatment for terrestrial and aquatic treatment areas', () => {
    expect(isRetreatmentEligibleFeatureType('Terrestrial Treatment Area')).toBe(true);
    expect(isRetreatmentEligibleFeatureType('Aquatic/Riparian Treatment Area')).toBe(true);
    expect(isRetreatmentEligibleFeatureType('Affected Area')).toBe(false);
    expect(isRetreatmentEligibleFeatureType('Easement/Acquisition')).toBe(false);
  });

  it('rejects retreatment for unsupported feature types', () => {
    expect(() => validateRetreatment('affected area', 'Y')).toThrow(HttpsError);
    expect(() => validateRetreatment('easement/acquisition', 'Y')).toThrow(
      'Retreatment is only supported for terrestrial and aquatic treatment areas',
    );
  });

  it('allows non-retreatment values for unsupported feature types', () => {
    expect(() => validateRetreatment('affected area', 'N')).not.toThrow();
    expect(() => validateRetreatment('dam', 'N')).not.toThrow();
  });

  it('converts booleans and strings to persistence values', () => {
    expect(booleanToRetreatment(true)).toBe('Y');
    expect(booleanToRetreatment(false)).toBe('N');
    expect(parseRetreatmentInput(true)).toBe('Y');
    expect(parseRetreatmentInput(false)).toBe('N');
    expect(parseRetreatmentInput('Y')).toBe('Y');
    expect(parseRetreatmentInput('true')).toBe('Y');
    expect(parseRetreatmentInput(undefined)).toBe('N');
  });

  it('converts persistence values to booleans', () => {
    expect(retreatmentToBoolean('Y')).toBe(true);
    expect(retreatmentToBoolean('N')).toBe(false);
    expect(retreatmentToBoolean(null)).toBe(false);
  });
});

describe('validateActions', () => {
  it('allows multiple herbicide values for Herbicide Application polygon actions', () => {
    expect(() =>
      validateActions('POLY', 'terrestrial treatment area', [
        {
          action: 'Herbicide Application',
          treatments: [{ treatment: 'Aerial (helicopter)', herbicides: ['Imazapic', 'Glyphosate'] }],
        },
      ]),
    ).not.toThrow();
  });

  it('rejects empty herbicide arrays for Herbicide Application polygon actions', () => {
    expect(() =>
      validateActions('POLY', 'terrestrial treatment area', [
        {
          action: 'Herbicide Application',
          treatments: [{ treatment: 'Aerial (helicopter)', herbicides: [] }],
        },
      ]),
    ).toThrow('Herbicide Application treatments require at least one herbicide');
  });

  it('rejects herbicide arrays containing only blank values for Herbicide Application polygon actions', () => {
    expect(() =>
      validateActions('POLY', 'terrestrial treatment area', [
        {
          action: 'Herbicide Application',
          treatments: [{ treatment: 'Aerial (helicopter)', herbicides: ['   '] }],
        },
      ]),
    ).toThrow('Herbicide Application treatments require at least one herbicide');
  });

  it('rejects non-array herbicide values', () => {
    expect(() =>
      validateActions('POLY', 'terrestrial treatment area', [
        {
          action: 'Herbicide Application',
          treatments: [{ treatment: 'Aerial (helicopter)', herbicides: 'Imazapic' as unknown as string[] }],
        },
      ]),
    ).toThrow('Each treatment herbicides value must be an array');
  });

  it('rejects herbicide values for non-herbicide polygon actions', () => {
    expect(() =>
      validateActions('POLY', 'terrestrial treatment area', [
        {
          action: 'Mechanical treatment',
          treatments: [{ treatment: 'Roller/crusher', herbicides: ['Imazapic'] }],
        },
      ]),
    ).toThrow('Herbicide values are only allowed for Herbicide Application actions');
  });
});

describe('canEditProject', () => {
  type TableName = 'PROJECT' | 'USERS' | 'CONTRIBUTOR';
  type ProjectRow = {
    projectManagerFk: number;
    status: string;
    features: string;
  };
  type UserRow = {
    userId: number;
    userGroup: string;
  };
  type ContributorRow = {
    Contributor_ID: number;
  };
  type DbRow = ProjectRow | UserRow | ContributorRow | undefined;

  type MockQuery = {
    from: (table: TableName) => MockQuery;
    where: (..._args: readonly unknown[]) => MockQuery;
    andWhere: (..._args: readonly unknown[]) => MockQuery;
    first: () => Promise<DbRow>;
  };

  type MockDb = {
    select: (..._args: readonly unknown[]) => MockQuery;
  };

  const createDbMock = ({
    project,
    user,
    contributor,
  }: {
    project?: ProjectRow;
    user?: UserRow;
    contributor?: ContributorRow;
  }) => {
    const queues: Record<TableName, DbRow[]> = {
      PROJECT: [project],
      USERS: [user],
      CONTRIBUTOR: [contributor],
    };

    const queriedTables: string[] = [];

    const db: MockDb = {
      select() {
        let tableName: TableName | undefined;
        const query: MockQuery = {
          from(table: TableName) {
            tableName = table;
            queriedTables.push(table);
            return this;
          },
          where() {
            return this;
          },
          andWhere() {
            return this;
          },
          async first() {
            if (!tableName) {
              return undefined;
            }

            const tableQueue = queues[tableName];
            return tableQueue.shift();
          },
        };

        return query;
      },
    };

    return { db: db as unknown as Knex, queriedTables };
  };

  const baseProject: ProjectRow = {
    projectManagerFk: 10,
    status: 'ACTIVE',
    features: 'YES',
  };

  const baseUser: UserRow = {
    userId: 20,
    userGroup: 'GROUP_EDITOR',
  };

  it('should return false when key or token is missing', async () => {
    const { db, queriedTables } = createDbMock({ project: baseProject, user: baseUser });

    await expect(canEditProject(db, 1, null, 'token')).resolves.toBe(false);
    await expect(canEditProject(db, 1, 'key', null)).resolves.toBe(false);

    expect(queriedTables.length).toBe(0);
  });

  it('should return false when project does not exist', async () => {
    const { db, queriedTables } = createDbMock({ project: undefined, user: baseUser });

    await expect(canEditProject(db, 1, 'key', 'token')).resolves.toBe(false);
    expect(queriedTables).toEqual(['PROJECT']);
  });

  it('should return false when user is not found or inactive', async () => {
    const { db, queriedTables } = createDbMock({ project: baseProject, user: undefined });

    await expect(canEditProject(db, 1, 'key', 'token')).resolves.toBe(false);
    expect(queriedTables).toEqual(['PROJECT', 'USERS']);
  });

  it('should return false for public/anonymous users', async () => {
    const publicCase = createDbMock({
      project: baseProject,
      user: { ...baseUser, userGroup: 'group_public' },
    });
    await expect(canEditProject(publicCase.db, 1, 'key', 'token')).resolves.toBe(false);

    const anonymousCase = createDbMock({
      project: baseProject,
      user: { ...baseUser, userGroup: 'GROUP_ANONYMOUS' },
    });
    await expect(canEditProject(anonymousCase.db, 1, 'key', 'token')).resolves.toBe(false);
  });

  it('should return false when features are NO for non-admin', async () => {
    const { db } = createDbMock({
      project: { ...baseProject, features: 'no' },
      user: baseUser,
    });

    await expect(canEditProject(db, 1, 'key', 'token')).resolves.toBe(false);
  });

  it('should return false when status is CANCELLED or COMPLETED for non-admin', async () => {
    const cancelled = createDbMock({
      project: { ...baseProject, status: 'cancelled' },
      user: baseUser,
    });
    await expect(canEditProject(cancelled.db, 1, 'key', 'token')).resolves.toBe(false);

    const completed = createDbMock({
      project: { ...baseProject, status: 'COMPLETED' },
      user: baseUser,
    });
    await expect(canEditProject(completed.db, 1, 'key', 'token')).resolves.toBe(false);
  });

  it('should return true for admin and skip contributor lookup', async () => {
    const { db, queriedTables } = createDbMock({
      project: { ...baseProject, features: 'NO', status: 'COMPLETED' },
      user: { ...baseUser, userGroup: 'GROUP_ADMIN' },
    });

    await expect(canEditProject(db, 1, 'key', 'token')).resolves.toBe(true);
    expect(queriedTables).toEqual(['PROJECT', 'USERS']);
  });

  it('should return true when user is project manager', async () => {
    const { db, queriedTables } = createDbMock({
      project: { ...baseProject, projectManagerFk: 20 },
      user: { ...baseUser, userId: 20 },
    });

    await expect(canEditProject(db, 1, 'key', 'token')).resolves.toBe(true);
    expect(queriedTables).toEqual(['PROJECT', 'USERS']);
  });

  it('should return true when user is a contributor', async () => {
    const { db, queriedTables } = createDbMock({
      project: baseProject,
      user: baseUser,
      contributor: { Contributor_ID: 999 },
    });

    await expect(canEditProject(db, 1, 'key', 'token')).resolves.toBe(true);
    expect(queriedTables).toEqual(['PROJECT', 'USERS', 'CONTRIBUTOR']);
  });

  it('should return false when user is not a contributor', async () => {
    const { db, queriedTables } = createDbMock({
      project: baseProject,
      user: baseUser,
      contributor: undefined,
    });

    await expect(canEditProject(db, 1, 'key', 'token')).resolves.toBe(false);
    expect(queriedTables).toEqual(['PROJECT', 'USERS', 'CONTRIBUTOR']);
  });
});
