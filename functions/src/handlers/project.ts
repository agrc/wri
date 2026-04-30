import type { PolygonFeature, ProjectResponse } from '@ugrc/wri-shared/types';
import * as logger from 'firebase-functions/logger';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../database.js';
import {
  canEditProject,
  convertMetersToAcres,
  convertMetersToMiles,
  processRollup,
  retreatmentToBoolean,
  throwIfNoFormData,
} from '../utils.js';

type ProjectPolygonFeature = PolygonFeature;

/**
 * Handler for project data requests
 * Fetches comprehensive project information including metadata, rollups, and features
 */
export const projectHandler = async ({ data }: CallableRequest): Promise<ProjectResponse> => {
  throwIfNoFormData(data);

  try {
    const id = parseInt(data?.id?.toString() ?? '-1', 10);

    if (isNaN(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid project ID');
    }

    const key = data?.key?.toString() ?? null;
    const token = data?.token?.toString() ?? null;

    const db = await getDb();
    const sizeExpression = db.raw('Shape.STNumPoints()');
    const rollupUnion = db
      .queryBuilder()
      .union([
        db
          .select({
            origin: db.raw(`'county'`),
            table: db.raw(`'poly'`),
            extra: db.raw('null'),
            name: db.ref('c.County'),
            space: db.ref('c.Intersection'),
          })
          .from({
            c: 'COUNTY',
          })
          .whereIn('c.FeatureID', db.select('POLY.FeatureID').from('POLY').where('POLY.Project_ID', id))
          .andWhere('c.FeatureClass', 'POLY'),
        db
          .select({
            origin: db.raw(`'owner'`),
            table: db.raw(`'poly'`),
            extra: db.ref('l.Admin'),
            name: db.ref('l.Owner'),
            space: db.ref('l.Intersection'),
          })
          .from({
            l: 'LANDOWNER',
          })
          .whereIn('l.FeatureID', db.select('POLY.FeatureID').from('POLY').where('POLY.Project_ID', id))
          .andWhere('l.FeatureClass', 'POLY'),
        db
          .select({
            origin: db.raw(`'sgma'`),
            table: db.raw(`'poly'`),
            extra: db.raw('null'),
            name: db.ref('s.SGMA'),
            space: db.ref('s.Intersection'),
          })
          .from({ s: 'SGMA' })
          .whereIn('s.FeatureID', db.select('POLY.FeatureID').from('POLY').where('POLY.Project_ID', id))
          .andWhere('s.FeatureClass', 'POLY'),
      ])
      .as('u');

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
        .from(rollupUnion)
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

          const herbicide = typeof feature.herbicide === 'string' ? feature.herbicide.trim() : '';
          const existing = acc[feature.id]!.find(
            (polygon: ProjectPolygonFeature) =>
              polygon.action === feature.action && polygon.subtype === feature.subtype,
          );

          if (existing) {
            if (herbicide && !existing.herbicides.includes(herbicide)) {
              existing.herbicides.push(herbicide);
            }

            return acc;
          }

          acc[feature.id]!.push({
            id: feature.id,
            type: feature.type,
            subtype: feature.subtype,
            action: feature.action,
            herbicides: herbicide ? [herbicide] : [],
            retreatment: retreatmentToBoolean(feature.retreatment),
            layer: 'feature-poly',
            size: convertMetersToAcres(feature.size),
          });
          return acc;
        },
        {} as Record<string, ProjectPolygonFeature[]>,
      );

    if (!project) {
      throw new HttpsError('not-found', `Project ${id} not found`);
    }

    // compute allowEdits using shared helper; the helper already returns false
    // when key/token are missing or the user/project fails any of the checks.
    const allowEdits = await canEditProject(db, id, key, token);

    const processed = processRollup(rollup);

    return {
      allowEdits,
      ...processed,
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
      stream: project.stream > 0 ? convertMetersToMiles(project.stream) : null,
      polygons: groupedPolygons,
      lines: features
        .filter((f) => f.origin === 'line')
        .map((f) => ({
          id: f.id,
          type: f.type,
          subtype: f.subtype,
          description: f.description,
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
