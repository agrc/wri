/**
 * Bootstraps local app startup.
 *
 * What it does:
 * - Reads `DEV_USER_EMAIL` from the root `.env.local` if present.
 * - If an email is configured, verifies the SQL proxy and looks up `UserKey` / `Token`
 *   for that user from the dev database.
 * - Starts the root `npm run start:stack` process.
 * - Injects `VITE_DEV_USER_KEY` / `VITE_DEV_USER_TOKEN` for that process only when a
 *   matching dev user is configured.
 *
 * Why it exists:
 * `npm start` is the only supported local entrypoint. This wrapper keeps local
 * startup read-only by default, while still allowing editable sessions when
 * `DEV_USER_EMAIL` is configured.
 */
import createKnex, { type Knex } from 'knex';
import { spawn } from 'node:child_process';
import {
  ensurePortIsReachable,
  getLocalProxyPort,
  readDatabaseInformation,
  readRequiredEnvLocal,
  rootDir,
} from './local-dev-database.ts';

const startLocalStack = (extraEnv: NodeJS.ProcessEnv = {}) => {
  const child = spawn('npm', ['run', 'start:stack'], {
    cwd: rootDir,
    env: {
      ...process.env,
      VITE_DEV_USER_KEY: '',
      VITE_DEV_USER_TOKEN: '',
      ...extraEnv,
    },
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
};

const envLocal = readRequiredEnvLocal();
const devUserEmail = envLocal['DEV_USER_EMAIL']?.trim();

if (!devUserEmail) {
  console.log('DEV_USER_EMAIL is not set. Starting local app without injected user credentials.');
  startLocalStack();
} else {
  const dbInfo = readDatabaseInformation();
  const dbHost = 'localhost';
  const dbPort = getLocalProxyPort(dbInfo);

  try {
    await ensurePortIsReachable(dbHost, dbPort);
  } catch (error) {
    const reason =
      error instanceof Error
        ? (error.message || error.name || 'unknown error').trim()
        : String(error).trim() || 'unknown error';
    console.error(`Error: Cannot reach DB proxy at ${dbHost}:${dbPort} (${reason}).`);
    console.error('Hint: start your Cloud SQL proxy first, then retry npm start.');
    process.exit(1);
  }

  const db = createKnex({
    client: 'mssql',
    connection: {
      database: dbInfo.database ?? 'WRI',
      server: dbHost,
      port: dbPort,
      user: dbInfo.user,
      password: dbInfo.password,
      options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 10000,
        requestTimeout: 10000,
      },
    } as Knex.MsSqlConnectionConfig,
  });

  try {
    console.log(`Connecting to database ${dbInfo.database ?? 'WRI'} at ${dbHost}:${dbPort}...`);
    const user = await db('USERS').where('Email', devUserEmail).first('UserKey', 'Token');

    if (!user) {
      console.error(`Error: User with email ${devUserEmail} not found in the database`);
      process.exit(1);
    }

    console.log(`Found user ${devUserEmail}. Starting local app with injected credentials...`);
    startLocalStack({
      VITE_DEV_USER_KEY: user.UserKey,
      VITE_DEV_USER_TOKEN: user.Token,
    });
  } catch (error) {
    console.error('Error querying database:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}
