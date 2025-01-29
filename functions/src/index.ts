import { https } from 'firebase-functions/v2';
import { Knex, knex } from 'knex';

const cors = [/ut-dts-agrc-wri-dev\.web\.app$/, /ut-dts-agrc-wri-prod\.web\.app$/];

const config: Knex.Config = {
  client: 'sqlite3',
  connection: {
    filename: './dev.sqlite3',
  },
  useNullAsDefault: true,
};

const db = knex(config);

const convertMetersToAcres = (meters: number) => `${(meters * 0.00024710538187021526).toFixed(2)} ac`;

export const health = https.onRequest({ cors }, async (_, res) => {
  res.send('healthy');
});

export const project = https.onRequest({ cors }, async (req, res) => {
  const id = parseInt(req.query.id?.toString() ?? '-1', 10);

  if (id === -1) {
    res.status(400).send('Invalid project ID');

    return;
  }

  const project = await db
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
    .first();

  const rollup = await db
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
    .groupBy('u.origin', 'u.name', 'u.extra', 'u.table');

  const features = await db
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
    ]);

  const groupedPolygons = features
    .filter((x) => x.origin === 'poly')
    .reduce(
      (acc, feature) => {
        if (!acc[feature.id]) {
          acc[feature.id] = [];
        }
        acc[feature.id].push({
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

  res.send({
    ...project,
    county: rollup
      .filter((r) => r.origin === 'county')
      .map((r) => ({ county: r.name, area: convertMetersToAcres(r.space) })),
    owner: rollup
      .filter((r) => r.origin === 'owner')
      .map((r) => ({ owner: r.name, admin: r.extra, area: convertMetersToAcres(r.space) })),
    sgma: rollup.filter((r) => r.origin === 'sgma').map((r) => ({ sgma: r.name, area: convertMetersToAcres(r.space) })),
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
  });

  return;
});
