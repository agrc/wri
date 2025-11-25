import { AuthTypes, Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall, onRequest, type HttpsOptions } from 'firebase-functions/v2/https';
import { default as knex, type Knex } from 'knex';

const databaseInformation = defineSecret('DATABASE_INFORMATION');

const cors = [
  /localhost:\d+$/, // Local dev
  /ut-dnr-dwr-wri-app-at\.web\.app$/, // deploy previews
  /utah\.gov$/, // remote dev, at, production
];

const options: HttpsOptions = {
  cors,
  region: 'us-west3',
  timeoutSeconds: 10,
  memory: '256MiB',
  maxInstances: 5,
  minInstances: 0,
  concurrency: 100,
};

// lazy loaded singleton
let db: knex.Knex | null = null;
let connector: Connector | null = null;

// Ensure connector is cleaned up on process exit
const cleanupConnector = async () => {
  if (connector) {
    try {
      connector.close();
    } catch (e) {
      // Optionally log error
      console.error('Error closing connector:', e);
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

registerCleanup();

const getDb = async () => {
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

export const project = onCall({ ...options, secrets: [databaseInformation] }, async (request) => {
  try {
    const db = await getDb();
    const id = parseInt(request.data?.id?.toString() ?? '-1', 10);

    const client = db.client;
    const clientName = (client.config?.client ?? client.dialect ?? '').toString();
    // SQLite doesn't support sql spatial, so use a literal 1 for size in that case.
    const sizeExpression = clientName.includes('sqlite') ? db.raw('1') : db.raw('Shape.STNumPoints()');

    if (isNaN(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid project ID');
    }

    const [project, rollup, features] = await Promise.all([
      db
        .select({
          id: 'Project_ID',
          manager: 'ProjectManagerName',
          agency: 'LeadAgencyOrg',
          title: 'title',
          status: 'Status',
          description: 'Description',
          region: 'ProjRegion',
          affected: 'AffectedAreaSqMeters',
          terrestrial: 'TerrestrialSqMeters',
          aquatic: 'AqRipSqMeters',
          easement: 'EasementAcquisitionSqMeters',
          stream: 'StreamLnMeters',
        })
        .from('PROJECT')
        .where('Project_ID', id)
        .first(),

      db
        .select('origin', 'table', 'name', 'extra', db.sum('space').as('space'))
        .from(function (this: Knex.QueryBuilder) {
          this.union([
            db
              .select(
                {
                  origin: db.raw(`'county'`),
                  table: db.raw(`'poly'`),
                  extra: db.raw('null'),
                },
                db.ref('c.County').as('name'),
                db.ref('c.Intersection').as('space'),
              )
              .from({
                c: 'COUNTY',
              })
              .whereIn('c.FeatureID', db.select('POLY.FeatureID').from('POLY').where('POLY.Project_ID', id))
              .andWhere('c.FeatureClass', 'POLY'),
            db
              .select(
                {
                  origin: db.raw(`'owner'`),
                  table: db.raw(`'poly'`),
                },
                db.ref('l.Owner').as('name'),
                db.ref('l.Admin').as('extra'),
                db.ref('l.Intersection').as('space'),
              )
              .from({
                l: 'LANDOWNER',
              })
              .whereIn('l.FeatureID', db.select('POLY.FeatureID').from('POLY').where('POLY.Project_ID', id))
              .andWhere('l.FeatureClass', 'POLY'),
            db
              .select(
                {
                  origin: db.raw(`'sgma'`),
                  table: db.raw(`'poly'`),
                  extra: db.raw('null'),
                },
                db.ref('s.SGMA').as('name'),
                db.ref('s.Intersection').as('space'),
              )
              .from({ s: 'SGMA' })
              .whereIn('s.FeatureID', db.select('POLY.FeatureID').from('POLY').where('POLY.Project_ID', id))
              .andWhere('s.FeatureClass', 'POLY'),
          ]).as('u');
        })
        .groupBy('u.origin', 'u.name', 'u.extra', 'u.table'),

      db
        .select({
          origin: db.raw(`'point'`),
          id: 'pt.FeatureID',
          type: 'pt.TypeDescription',
          subtype: 'pt.FeatureSubTypeDescription',
          action: 'pt.ActionDescription',
          description: 'pt.description',
          retreatment: db.raw('NULL'),
          herbicide: db.raw('NULL'),
          size: sizeExpression,
        })
        .from({ pt: 'POINT' })
        .where('pt.Project_ID', id)
        .unionAll([
          db
            .select({
              origin: db.raw(`'line'`),
              id: 'l.FeatureID',
              type: 'l.TypeDescription',
              subtype: 'l.FeatureSubTypeDescription',
              action: 'l.ActionDescription',
              description: db.raw('NULL'),
              retreatment: db.raw('NULL'),
              herbicide: db.raw('NULL'),
              size: 'l.LengthLnMeters',
            })
            .from({ l: 'LINE' })
            .where('l.Project_ID', id),
          db
            .select({
              origin: db.raw(`'poly'`),
              id: 'p.FeatureID',
              type: 'p.TypeDescription',
              subtype: 't.TreatmentTypeDescription',
              action: 'a.ActionDescription',
              description: db.raw('NULL'),
              retreatment: 'p.Retreatment',
              herbicide: 'h.HerbicideDescription',
              size: 'p.AreaSqMeters',
            })
            .from({ p: 'POLY' })
            .leftOuterJoin({ a: 'AreaACTION' }, 'p.FeatureID', 'a.FeatureID')
            .leftOuterJoin({ t: 'AreaTreatment' }, 'a.AreaActionId', 't.AreaActionId')
            .leftOuterJoin({ h: 'AREAHERBICIDE' }, 't.AreaTreatmentID', 'h.AreaTreatmentID')
            .where('Project_ID', id),
        ]),
    ]);

    const groupedPolygons = features
      .filter((x) => x.origin === 'poly')
      .reduce(
        (acc, feature) => {
          if (!acc[feature.id]) {
            acc[feature.id] = [];
          }

          acc[feature.id]!.push({
            id: feature.id,
            type: feature.type,
            subtype: feature.subtype,
            action: feature.action,
            herbicide: feature.herbicide,
            retreatment: feature.retreatment,
            layer: 'feature-poly',
            size: convertMetersToAcres(feature.size),
          });
          return acc;
        },
        {} as Record<
          string,
          Array<{
            id: number;
            type: string;
            subtype: string;
            action: string;
            herbicide: string;
            retreatment: boolean;
            layer: 'feature-poly';
            size: string;
          }>
        >,
      );

    if (!project) {
      throw new HttpsError('not-found', `Project ${id} not found`);
    }

    return {
      ...project,
      county: rollup
        .filter((r) => r.origin === 'county')
        .map((r) => ({ county: r.name, area: convertMetersToAcres(r.space) })),
      owner: rollup
        .filter((r) => r.origin === 'owner')
        .map((r) => ({ owner: r.name, admin: r.extra, area: convertMetersToAcres(r.space) })),
      sgma: rollup
        .filter((r) => r.origin === 'sgma')
        .map((r) => ({ sgma: r.name, area: convertMetersToAcres(r.space) })),
      polygons: groupedPolygons,
      lines: features
        .filter((f) => f.origin === 'line')
        .map((f) => ({
          id: f.id,
          type: f.type,
          subtype: f.subtype,
          action: f.action,
          layer: 'feature-line',
          size: `${f.size} meters`,
        })),
      points: features
        .filter((f) => f.origin === 'point')
        .map((f) => ({
          id: f.id,
          type: f.type,
          subtype: f.subtype,
          description: f.description,
          action: f.action,
          layer: 'feature-point',
          size: `${f.size}`,
        })),
    };
  } catch (error) {
    console.error('Error fetching project data:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', 'Failed to fetch project data');
  }
});

export const feature = onCall({ ...options, secrets: [databaseInformation] }, async (request) => {
  try {
    const db = await getDb();

    console.log('Request data:', request.data);
    const project = parseInt(request.data?.id?.toString() ?? '-1', 10);
    const featureId = parseInt(request.data?.featureId?.toString() ?? '-1', 10);
    const type = request.data?.type?.toString().toLowerCase() ?? '';

    if (isNaN(project) || project <= 0 || project > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid project ID');
    }

    if (isNaN(featureId) || featureId <= 0 || featureId > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid feature ID');
    }

    if (!(type in tableLookup)) {
      throw new HttpsError('invalid-argument', 'Invalid feature type');
    }

    const table = tableLookup[type] as string;

    const rollupQuery = db
      .select({
        origin: db.raw(`'county'`),
        table: db.raw('?', [table]),
        name: 'c.County',
        extra: db.raw('null'),
        space: 'c.Intersection',
      })
      .from({ c: 'COUNTY' })
      .where('c.FeatureID', featureId)
      .andWhere('c.FeatureClass', table)
      .unionAll([
        db
          .select({
            origin: db.raw(`'sgma'`),
            table: db.raw('?', [table]),
            name: 's.SGMA',
            extra: db.raw('null'),
            space: 's.Intersection',
          })
          .from({ s: 'SGMA' })
          .where('s.FeatureID', featureId)
          .andWhere('s.FeatureClass', table),
        db
          .select({
            origin: db.raw(`'owner'`),
            table: db.raw('?', [table]),
            name: 'l.Owner',
            extra: 'l.Admin',
            space: 'l.Intersection',
          })
          .from({ l: 'LANDOWNER' })
          .where('l.FeatureID', featureId)
          .andWhere('l.FeatureClass', table),
        db
          .select({
            origin: db.raw(`'nhd'`),
            table: db.raw('?', [table]),
            name: 'n.StreamDescription',
            extra: db.raw('null'),
            space: 'n.Intersection',
          })
          .from({ n: 'STREAM' })
          .where('n.FeatureID', featureId)
          .andWhereRaw('?=?', [table, 'POLY']),
      ]);

    console.log('Rollup query SQL:', rollupQuery.toString());
    const rollup = await rollupQuery;

    console.log('Rollup results:', rollup);

    return {
      county: rollup.filter((x) => x.origin === 'county'),
      sageGrouse: rollup.filter((x) => x.origin === 'sgma'),
      landOwnership: rollup.filter((x) => x.origin === 'owner'),
      stream: rollup.filter((x) => x.origin === 'nhd'),
    };
  } catch (error) {
    console.error('Error fetching feature data:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', 'Failed to fetch feature data');
  }
});

const tableLookup: Record<string, string> = {
  'terrestrial treatment area': 'POLY',
  'aquatic/riparian treatment area': 'POLY',
  'affected area': 'POLY',
  'easement/acquisition': 'POLY',
  guzzler: 'POINT',
  'water development point feature': 'POINT',
  'other point feature': 'POINT',
  'fish passage structure': 'POINT',
  fence: 'LINE',
  pipeline: 'LINE',
  dam: 'LINE',
};

const convertMetersToAcres = (meters: number) => `${(meters * 0.00024710538187021526).toFixed(2)} ac`;

const health = onRequest({ ...options, memory: '128MiB', maxInstances: 1 }, async (_, res) => {
  res.send('healthy');
});

// Only export health check in emulator mode
export const healthCheck = process.env.FUNCTIONS_EMULATOR === 'true' ? health : undefined;
