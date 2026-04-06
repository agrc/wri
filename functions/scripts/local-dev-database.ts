import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, '../..');
export const functionsDir = path.resolve(__dirname, '..');
export const envLocalPath = path.resolve(rootDir, '.env.local');
export const secretLocalPath = path.resolve(functionsDir, '.secret.local');

interface DatabaseInformation {
  database?: string;
  password?: string;
  port?: string;
  user?: string;
}

const parseEnvFile = (filePath: string) => {
  const content = fs.readFileSync(filePath, 'utf-8');

  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const [key, ...value] = line.split('=');
        let parsedValue = value.join('=').trim();

        if (
          (parsedValue.startsWith('"') && parsedValue.endsWith('"')) ||
          (parsedValue.startsWith("'") && parsedValue.endsWith("'"))
        ) {
          parsedValue = parsedValue.slice(1, -1);
        }

        return [key.trim(), parsedValue];
      }),
  );
};

export const readRequiredEnvLocal = () => {
  if (!fs.existsSync(envLocalPath)) {
    console.error(`Error: .env.local not found at ${envLocalPath}`);
    process.exit(1);
  }

  return parseEnvFile(envLocalPath);
};

export const readDatabaseInformation = (): DatabaseInformation => {
  if (!fs.existsSync(secretLocalPath)) {
    console.error(`Error: .secret.local not found at ${secretLocalPath}`);
    process.exit(1);
  }

  const secretLocal = parseEnvFile(secretLocalPath);
  const dbInfoStr = secretLocal['DATABASE_INFORMATION'];

  if (!dbInfoStr) {
    console.error('Error: DATABASE_INFORMATION is not set in .secret.local');
    process.exit(1);
  }

  const dbInfo = JSON.parse(dbInfoStr) as DatabaseInformation;

  if (!dbInfo.user || !dbInfo.password) {
    console.error('Error: Database credentials are not set in DATABASE_INFORMATION');
    process.exit(1);
  }

  return dbInfo;
};

export const getLocalProxyPort = (dbInfo: DatabaseInformation) => {
  const port = Number.parseInt(dbInfo.port ?? '', 10);

  if (!Number.isFinite(port)) {
    console.error(`Error: DATABASE_INFORMATION.port is invalid: ${dbInfo.port}`);
    process.exit(1);
  }

  return port;
};

export const ensurePortIsReachable = async (host: string, port: number, timeoutMs = 2500) => {
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
