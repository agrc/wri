import { ensurePortIsReachable, getLocalProxyPort, readDatabaseInformation } from './local-dev-database.ts';

const dbInfo = readDatabaseInformation();
const host = 'localhost';
const port = getLocalProxyPort(dbInfo);

try {
  await ensurePortIsReachable(host, port);
  console.log(`Cloud SQL proxy is reachable at ${host}:${port}.`);
} catch (error) {
  const reason =
    error instanceof Error
      ? (error.message || error.name || 'unknown error').trim()
      : String(error).trim() || 'unknown error';

  console.error(`Error: Cannot reach DB proxy at ${host}:${port} (${reason}).`);
  console.error('Hint: start your Cloud SQL proxy first, then retry npm start.');
  process.exit(1);
}
