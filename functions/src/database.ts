import { AuthTypes, Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import * as logger from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';
import { default as knex, type Knex } from 'knex';

export const databaseInformation = defineSecret('DATABASE_INFORMATION');

// Lazy-loaded singletons cached in global scope for reuse across invocations
let db: knex.Knex | null = null;
let connector: Connector | null = null;

/**
 * Cleanup the connector to prevent resource leaks
 */
const cleanupConnector = async () => {
  if (connector) {
    try {
      connector.close();
    } catch (e) {
      logger.error('Error closing connector:', e);
    }
    connector = null;
  }
};

// Register cleanup on process exit events
interface RegisterCleanupFunction {
  (): void;
  _registered?: boolean;
}

const registerCleanup: RegisterCleanupFunction = () => {
  // Only register once
  if (registerCleanup._registered) {
    return;
  }

  registerCleanup._registered = true;

  process.on('exit', () => {
    cleanupConnector();
  });
  process.on('SIGINT', () => {
    cleanupConnector().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    cleanupConnector().then(() => process.exit(0));
  });
};

// Initialize cleanup handlers
registerCleanup();

interface DatabaseInformation {
  database?: string;
  instance?: string;
  password?: string;
  port?: string;
  user?: string;
}

const getDatabaseInformation = (): DatabaseInformation => {
  const dbInfo = JSON.parse(databaseInformation.value() || '{}') as DatabaseInformation;

  if (!dbInfo.user || !dbInfo.password) {
    throw new HttpsError('failed-precondition', 'Database credentials are not set');
  }

  return dbInfo;
};

/**
 * Get or create a database connection
 * This function is cached in global scope and will be reused across function invocations
 * @returns Knex database instance
 */
export const getDb = async () => {
  if (!db) {
    const config: Knex.Config = {
      client: 'mssql',
    };

    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      const dbInfo = getDatabaseInformation();
      const port = Number.parseInt(dbInfo.port ?? '', 10);

      if (!Number.isFinite(port)) {
        throw new HttpsError('failed-precondition', 'Database proxy port is not set');
      }

      config.connection = {
        database: dbInfo.database ?? 'WRI',
        server: 'localhost',
        port,
        user: dbInfo.user,
        password: dbInfo.password,
        options: {
          encrypt: true,
          trustServerCertificate: true,
          enableArithAbort: true,
          connectTimeout: 10000,
          requestTimeout: 10000,
        },
      } as Knex.MsSqlConnectionConfig;
    } else {
      const dbInfo = getDatabaseInformation();

      if (!dbInfo.instance) {
        throw new HttpsError('failed-precondition', 'Database instance is not set');
      }

      connector = new Connector();

      const clientOptions = await connector.getTediousOptions({
        instanceConnectionName: dbInfo.instance,
        ipType: IpAddressTypes.PUBLIC,
        authType: AuthTypes.PASSWORD,
      });

      config.connection = {
        database: dbInfo.database ?? 'WRI',
        server: '0.0.0.0',
        user: dbInfo.user,
        password: dbInfo.password,
        options: {
          ...clientOptions,
          encrypt: true,
          trustServerCertificate: true,
          enableArithAbort: true,
          connectTimeout: 10000,
          requestTimeout: 10000,
        },
      } as Knex.MsSqlConnectionConfig;
    }

    config.pool = {
      min: 0,
      max: 5,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
    };

    db = knex(config);
  }

  return db;
};
