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

/**
 * Get or create a database connection
 * This function is cached in global scope and will be reused across function invocations
 * @returns Knex database instance
 */
export const getDb = async () => {
  if (!db) {
    const config: Knex.Config = {
      client: 'sqlite3',
      connection: { filename: './dev.sqlite3' },
      useNullAsDefault: true,
    };

    if (process.env.FUNCTIONS_EMULATOR !== 'true') {
      const dbInfo = JSON.parse(databaseInformation.value() || '{}');

      if (!dbInfo.user || !dbInfo.password) {
        throw new HttpsError('failed-precondition', 'Database credentials are not set');
      }

      connector = new Connector();

      const clientOptions = await connector.getTediousOptions({
        instanceConnectionName: dbInfo.instance,
        ipType: IpAddressTypes.PUBLIC,
        authType: AuthTypes.PASSWORD,
      });

      config.client = 'mssql';
      config.connection = {
        database: 'WRI',
        server: '0.0.0.0', // The proxy server address
        user: dbInfo.user,
        password: dbInfo.password,
        options: {
          ...clientOptions,
          encrypt: true, // required for MS Cloud SQL
          trustServerCertificate: true, // required for MS Cloud SQL
          enableArithAbort: true,
          connectTimeout: 10000,
          requestTimeout: 10000,
        },
      } as Knex.MsSqlConnectionConfig;

      config.pool = {
        min: 0,
        max: 5,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
      };
    }

    if (process.env.USE_PROD_DB === 'true') {
      const dbInfo = JSON.parse(databaseInformation.value() || '{}');

      if (!dbInfo.user || !dbInfo.password) {
        throw new HttpsError('failed-precondition', 'Database credentials are not set');
      }

      config.client = 'mssql';
      config.connection = {
        database: dbInfo.database ?? 'WRI',
        server: 'localhost', // proxy address
        port: parseInt(dbInfo.port),
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

      config.pool = {
        min: 0,
        max: 5,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
      };
    }

    db = knex(config);
  }

  return db;
};
