import type { Knex } from 'knex';
import { describe, expect, it } from 'vitest';
import { canEditProject } from './utils.js';

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
