import { AuthTypes, Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import createKnex, { type Knex } from 'knex';
import { ensurePortIsReachable, getLocalProxyPort, readDatabaseInformation } from './local-dev-database.ts';

type DatabaseInformation = {
  database?: string;
  instance?: string;
  password?: string;
  port?: string;
  user?: string;
};

const MIGRATION_TABLE_NAME = 'knex_migrations';
const MIGRATIONS_DIRECTORY = new URL('../migrations', import.meta.url).pathname;

const getDatabaseInformation = (): DatabaseInformation => {
  const envValue = process.env['DATABASE_INFORMATION']?.trim();

  if (!envValue) {
    return readDatabaseInformation();
  }

  const parsed = JSON.parse(envValue) as DatabaseInformation;

  if (!parsed.user || !parsed.password) {
    throw new Error('DATABASE_INFORMATION is missing required user/password values');
  }

  return parsed;
};

const getBaseMigrationConfig = (): Knex.Config => ({
  client: 'mssql',
  pool: {
    min: 0,
    max: 2,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
  },
  migrations: {
    directory: MIGRATIONS_DIRECTORY,
    extension: 'ts',
    loadExtensions: ['.ts'],
    tableName: MIGRATION_TABLE_NAME,
  },
});

const getProxyConnection = async (dbInfo: DatabaseInformation): Promise<Knex.MsSqlConnectionConfig> => {
  const port = getLocalProxyPort(dbInfo);
  const host = 'localhost';

  await ensurePortIsReachable(host, port);

  return {
    database: dbInfo.database ?? 'WRI',
    server: host,
    port,
    user: dbInfo.user!,
    password: dbInfo.password!,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 10000,
      requestTimeout: 10000,
    },
  } as Knex.MsSqlConnectionConfig;
};

const getConnectorConnection = async (
  dbInfo: DatabaseInformation,
  connector: Connector,
): Promise<Knex.MsSqlConnectionConfig> => {
  if (!dbInfo.instance) {
    throw new Error('DATABASE_INFORMATION must include either port for a local proxy or instance for Cloud SQL');
  }

  const clientOptions = await connector.getTediousOptions({
    instanceConnectionName: dbInfo.instance,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.PASSWORD,
  });

  return {
    database: dbInfo.database ?? 'WRI',
    server: '0.0.0.0',
    user: dbInfo.user!,
    password: dbInfo.password!,
    options: {
      ...clientOptions,
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 10000,
      requestTimeout: 10000,
    },
  } as Knex.MsSqlConnectionConfig;
};

export const createMigrationDatabase = async () => {
  const dbInfo = getDatabaseInformation();
  const connector = !dbInfo.port && dbInfo.instance ? new Connector() : null;

  const config = getBaseMigrationConfig();
  config.connection = connector ? await getConnectorConnection(dbInfo, connector) : await getProxyConnection(dbInfo);

  const db = createKnex(config);

  return {
    db,
    async destroy() {
      await db.destroy();
      connector?.close();
    },
  };
};

export const getMigrationMetadata = () => ({
  directory: MIGRATIONS_DIRECTORY,
  tableName: MIGRATION_TABLE_NAME,
});
