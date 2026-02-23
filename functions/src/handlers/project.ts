import * as logger from 'firebase-functions/logger';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Knex } from 'knex';
import { getDb } from '../database.js';
import { convertMetersToAcres, processRollup, throwIfNoFormData } from '../utils.js';

/**
 * Handler for project data requests
 * Fetches comprehensive project information including metadata, rollups, and features
 */
export const projectHandler = async ({ data }: CallableRequest) => {
  throwIfNoFormData(data);

  try {
    const id = parseInt(data?.id?.toString() ?? '-1', 10);

    if (isNaN(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid project ID');
    }

    const key = data?.key?.toString() ?? null;
    const token = data?.token?.toString() ?? null;

    const db = await getDb();
    const client = db.client;
    const clientName = (client.config?.client ?? client.dialect ?? '').toString();
    // SQLite doesn't support sql spatial in dev, so use a literal 1 for size in that case.
    const sizeExpression = clientName.includes('sqlite') ? db.raw('1') : db.raw('Shape.STNumPoints()');

    logger.info('Fetching project data', { id });

    const [project, rollup, features] = await Promise.all([
      db
        .select({
          id: 'Project_ID',
          manager: 'ProjectManagerName',
          agency: 'LeadAgencyOrg',
          title: 'Title',
          status: 'Status',
          description: 'Description',
          region: 'ProjRegion',
          affected: 'AffectedAreaSqMeters',
          terrestrial: 'TerrestrialSqMeters',
          aquatic: 'AqRipSqMeters',
          easement: 'EasementAcquisitionSqMeters',
          stream: 'StreamLnMeters',
          projectManagerFk: 'ProjectManager_ID',
          features: 'Features',
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

    // Compute allowEdits — matches the logic from the old .NET ProjectController.
    // key/token are optional; if absent the project data is still returned with allowEdits: false.
    let allowEdits = false;

    if (key && token) {
      const user = await db
        .select({ userId: 'User_ID', userGroup: 'user_group' })
        .from('USERS')
        .where('UserKey', key)
        .andWhere('Token', token)
        .andWhere('Active', 'YES')
        .first();

      if (user) {
        const isAdmin = user.userGroup === 'GROUP_ADMIN';

        // Condition 1: user found (already satisfied by reaching this block)
        // Condition 2: not an anonymous or public user
        const passesRoleCheck = !['GROUP_ANONYMOUS', 'GROUP_PUBLIC'].includes(user.userGroup);

        // Condition 3: project has features enabled, or user is admin
        const passesFeaturesCheck = project.features !== 'No' || isAdmin;

        // Condition 4: project is not cancelled/completed, or user is admin
        const passesStatusCheck = !['Cancelled', 'Completed'].includes(project.status) || isAdmin;

        if (passesRoleCheck && passesFeaturesCheck && passesStatusCheck) {
          // Condition 5: user is the project manager, a contributor, or an admin
          const isProjectManager = user.userId === project.projectManagerFk;

          if (isAdmin || isProjectManager) {
            allowEdits = true;
          } else {
            const contributor = await db
              .select('Contributor_ID')
              .from('CONTRIBUTOR')
              .where('User_FK', user.userId)
              .andWhere('Project_FK', id)
              .first();

            allowEdits = contributor != null;
          }
        }
      }
    }

    const processed = processRollup(rollup);

    return {
      allowEdits,
      id: project.id,
      manager: project.manager,
      agency: project.agency,
      title: project.title,
      status: project.status,
      description: project.description,
      region: project.region,
      affected: project.affected > 0 ? convertMetersToAcres(project.affected) : null,
      terrestrial: project.terrestrial > 0 ? convertMetersToAcres(project.terrestrial) : null,
      aquatic: project.aquatic > 0 ? convertMetersToAcres(project.aquatic) : null,
      easement: project.easement > 0 ? convertMetersToAcres(project.easement) : null,
      stream: project.stream > 0 ? convertMetersToAcres(project.stream) : null,
      ...processed,
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
    logger.error('Error fetching project data:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', 'Failed to fetch project data');
  }
};
