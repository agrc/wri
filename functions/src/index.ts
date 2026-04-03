import { onCall, onRequest, type HttpsOptions } from 'firebase-functions/v2/https';
import { databaseInformation } from './database.js';

// CORS configuration cached in global scope
const cors = [
  /localhost:\d+$/, // Local dev
  /ut-dnr-dwr-wri-app-at\.web\.app$/, // deploy previews
  /utah\.gov$/, // remote dev, at, production
];

const isDev = process.env.FUNCTIONS_EMULATOR === 'true';

// Shared function options cached in global scope
const options: HttpsOptions = {
  cors,
  region: 'us-west3',
  timeoutSeconds: isDev ? 3600 : 30, // use a large number in dev so that we have time to step through execution while debugging
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
 * Callable function for deleting a feature
 * Dynamically imports the handler to improve cold start performance
 */
export const deleteFeature = onCall({ ...options, secrets: [databaseInformation] }, async (request) => {
  const { deleteFeatureHandler } = await import('./handlers/deleteFeature.js');

  return deleteFeatureHandler(request);
});

/**
 * Callable function for recalculating project-level spatial statistics
 * Dynamically imports the handler to improve cold start performance
 */
export const updateProjectStats = onCall({ ...options, secrets: [databaseInformation] }, async (request) => {
  const { updateProjectStatsHandler } = await import('./handlers/updateProjectStats.js');

  return updateProjectStatsHandler(request);
});

/**
 * Callable function for fetching editing domain data (valid feature attributes)
 * Dynamically imports the handler to improve cold start performance
 */
export const editingDomains = onCall({ ...options, secrets: [databaseInformation] }, async () => {
  const { editingDomainsHandler } = await import('./handlers/editingDomains.js');

  return editingDomainsHandler();
});

/**
 * Callable function for creating a new feature
 * Dynamically imports the handler to improve cold start performance
 */
export const createFeature = onCall({ ...options, secrets: [databaseInformation] }, async (request) => {
  const { createFeatureHandler } = await import('./handlers/createFeature.js');

  return createFeatureHandler(request);
});

/**
 * Health check endpoint for monitoring
 */
const health = onRequest({ ...options, memory: '128MiB', maxInstances: 1 }, async (_, res) => {
  res.send('healthy');
});

// Only export health check in emulator mode
export const healthCheck = isDev ? health : undefined;
