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

const getDb = () => {
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

      // Production config for Cloud SQL
      config.client = 'mssql';
      config.connection = {
        server: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION}`,
        database: 'WRI',
        // Add credentials if using SQL Server authentication
        user: dbInfo.user,
        password: dbInfo.password,
        options: {
          encrypt: false, // Unix socket connections don't use TLS
          trustServerCertificate: true,
          enableArithAbort: true,
        },
      };
      config.pool = {
        min: 0, // Allow scaling to zero for serverless
        max: 5, // Limit connections for Cloud Functions
        idleTimeoutMillis: 30000,
      };
    }

    db = knex(config);
  }
  return db;
};

export const project = onCall({ ...options, secrets: [databaseInformation] }, async (request) => {
  try {
    const db = getDb();
    const id = parseInt(request.data?.id?.toString() ?? '-1', 10);

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
          size: db.raw('0'), // TODO!: replace with .STNumPoints()
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

const convertMetersToAcres = (meters: number) => `${(meters * 0.00024710538187021526).toFixed(2)} ac`;

const health = onRequest({ ...options, memory: '128MiB', maxInstances: 1 }, async (_, res) => {
  res.send('healthy');
});

// Only export health check in emulator mode
export const healthCheck = process.env.FUNCTIONS_EMULATOR === 'true' ? health : undefined;
