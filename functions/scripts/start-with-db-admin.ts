/**
 * Bootstraps local app startup with real database-backed user credentials.
 *
 * What it does:
 * - Reads `DEV_USER_EMAIL` from the root `.env.local`.
 * - Reads SQL proxy connection settings from `functions/.secret.local`.
 * - Verifies the SQL proxy port is reachable.
 * - Looks up `UserKey` and `Token` for that email in `USERS`.
 * - Starts the root `npm run start` process with `USE_PROD_DB=true` and
 *   overrides `VITE_DEV_USER_KEY` / `VITE_DEV_USER_TOKEN` for this run.
 *
 * Why it exists:
 * Local `start:with-db` needs real credentials from the database so you can
 * run the app as your actual account (for admin/edit permissions) without
 * manually copying key/token values into `.env.local` each time.
 */
import createKnex, { type Knex } from 'knex';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../..');
const functionsDir = path.resolve(__dirname, '..');

const envLocalPath = path.resolve(rootDir, '.env.local');
const secretLocalPath = path.resolve(functionsDir, '.secret.local');

if (!fs.existsSync(envLocalPath)) {
  console.error(`Error: .env.local not found at ${envLocalPath}`);
  process.exit(1);
}

if (!fs.existsSync(secretLocalPath)) {
  console.error(`Error: .secret.local not found at ${secretLocalPath}`);
  process.exit(1);
}

// Parse .env.local
const envLocalContent = fs.readFileSync(envLocalPath, 'utf-8');
const envLocal = Object.fromEntries(
  envLocalContent
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const [key, ...value] = line.split('=');
      let val = value.join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [key.trim(), val];
    }),
);

const devUserEmail = envLocal['DEV_USER_EMAIL'];
if (!devUserEmail) {
  console.error('Error: DEV_USER_EMAIL is not set in .env.local');
  process.exit(1);
}

// Parse .secret.local
const secretLocalContent = fs.readFileSync(secretLocalPath, 'utf-8');
const secretLocal = Object.fromEntries(
  secretLocalContent
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const [key, ...value] = line.split('=');
      let val = value.join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [key.trim(), val];
    }),
);

const dbInfoStr = secretLocal['DATABASE_INFORMATION'];
if (!dbInfoStr) {
  console.error('Error: DATABASE_INFORMATION is not set in .secret.local');
  process.exit(1);
}

const dbInfo = JSON.parse(dbInfoStr);

if (!dbInfo.user || !dbInfo.password) {
  console.error('Error: Database credentials are not set in DATABASE_INFORMATION');
  process.exit(1);
}

const dbHost = 'localhost';
const dbPort = Number.parseInt(dbInfo.port, 10);

if (!Number.isFinite(dbPort)) {
  console.error(`Error: DATABASE_INFORMATION.port is invalid: ${dbInfo.port}`);
  process.exit(1);
}

const ensurePortIsReachable = async (host: string, port: number, timeoutMs = 2500) => {
  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish());
    socket.once('timeout', () => finish(new Error(`Timed out after ${timeoutMs}ms`)));
    socket.once('error', (error) => finish(error));
    socket.connect(port, host);
  });
};

try {
  await ensurePortIsReachable(dbHost, dbPort);
} catch (error) {
  const reason =
    error instanceof Error
      ? (error.message || error.name || 'unknown error').trim()
      : String(error).trim() || 'unknown error';
  console.error(`Error: Cannot reach DB proxy at ${dbHost}:${dbPort} (${reason}).`);
  console.error('Hint: start your Cloud SQL proxy first, then retry npm run start:with-db');
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

  console.log(`Found user ${devUserEmail}. Starting app with admin credentials...`);

  const child = spawn('npm', ['run', 'start'], {
    cwd: rootDir,
    env: {
      ...process.env,
      USE_PROD_DB: 'true',
      VITE_DEV_USER_KEY: user.UserKey,
      VITE_DEV_USER_TOKEN: user.Token,
    },
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
} catch (error) {
  console.error('Error querying database:', error);
  process.exit(1);
} finally {
  await db.destroy();
}
