import { onCall, onRequest, type HttpsOptions } from 'firebase-functions/v2/https';
import { databaseInformation } from './database.js';

// CORS configuration cached in global scope
const cors = [
  /localhost:\d+$/, // Local dev
  /ut-dnr-dwr-wri-app-at\.web\.app$/, // deploy previews
  /utah\.gov$/, // remote dev, at, production
];

// Shared function options cached in global scope
const options: HttpsOptions = {
  cors,
  region: 'us-west3',
  timeoutSeconds: 10,
  memory: '256MiB',
  maxInstances: 5,
  minInstances: 0,
  concurrency: 100,
};

/**
 * Callable function for fetching project data
 * Dynamically imports the handler to improve cold start performance
 */
export const project = onCall({ ...options, secrets: [databaseInformation] }, async (request) => {
  const { projectHandler } = await import('./handlers/project.js');

  return projectHandler(request);
});

/**
 * Callable function for fetching feature data
 * Dynamically imports the handler to improve cold start performance
 */
export const feature = onCall({ ...options, secrets: [databaseInformation] }, async (request) => {
  const { featureHandler } = await import('./handlers/feature.js');

  return featureHandler(request);
});

/**
 * Health check endpoint for monitoring
 */
const health = onRequest({ ...options, memory: '128MiB', maxInstances: 1 }, async (_, res) => {
  res.send('healthy');
});

// Only export health check in emulator mode
export const healthCheck = process.env.FUNCTIONS_EMULATOR === 'true' ? health : undefined;
