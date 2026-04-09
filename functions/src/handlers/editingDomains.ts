import type { EditingDomainsResponse, FeatureTable, PolyFeatureAttributes } from '@ugrc/wri-shared/types';
import * as logger from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';
import { getDb } from '../database.js';

// FeatureTypeID = 5 is the generic point/line action type in the LU_FEATURETYPE table
// (matches the old .NET API's hardcoded value in StandardQueries.cs)
const POINT_LINE_FEATURE_TYPE_ID = 5;
const AFFECTED_AREA_FEATURE_TYPE = 'affected area';
const alphabeticalSort = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const sortRecordByKey = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).sort(([left], [right]) => alphabeticalSort.compare(left, right))) as Record<
    string,
    T
  >;

/**
 * Handler for fetching editing domain data (valid feature attributes).
 * Returns the valid actions/treatments/herbicides for each feature category,
 * the list of available herbicides, and the list of available point/line actions.
 * No authentication required — this is read-only public lookup data.
 */
export const editingDomainsHandler = async (): Promise<EditingDomainsResponse> => {
  try {
    const db = await getDb();

    const [polyRows, pointLineRows, herbicideRows, actionRows, featureTypeRows, affectedAreaActionRows] =
      await Promise.all([
      // Polygon feature types: actions → treatments
      db
        .select({
          category: 'ft.FeatureTypeDescription',
          action: 'a.ActionDescription',
          treatment: 't.TreatmentTypeDescription',
        })
        .from({ ft: 'LU_FEATURETYPE' })
        .join('FEATURE_ACTION as fa', 'fa.FeatureTypeID', 'ft.FeatureTypeID')
        .join('LU_ACTION as a', 'a.ActionID', 'fa.ActionID')
        .join('ACTION_TREATMENT as at', 'at.ActionID', 'a.ActionID')
        .join('LU_TREATMENTTYPE as t', 't.TreatmentTypeID', 'at.TreatmentTypeID')
        .whereRaw("LOWER(ft.FeatureClassAssociation) = 'poly'")
        .andWhereRaw('LOWER(ft.FeatureTypeDescription) <> ?', [AFFECTED_AREA_FEATURE_TYPE])
        .orderBy('ft.FeatureTypeDescription')
        .orderBy('a.ActionDescription')
        .orderBy('t.TreatmentTypeDescription'),

      // Point/Line feature types: subtypes
      db
        .select({
          category: 'ft.FeatureTypeDescription',
          subtype: 'fst.FeatureSubTypeDescription',
        })
        .from({ ft: 'LU_FEATURETYPE' })
        .leftJoin('FEATURETYPE_FEATURESUBTYPE as ffst', 'ffst.FeatureTypeID', 'ft.FeatureTypeID')
        .leftJoin('LU_FEATURESUBTYPE as fst', 'fst.FeatureSubTypeID', 'ffst.FeatureSubTypeID')
        .whereRaw("LOWER(ft.FeatureClassAssociation) IN ('point', 'line')")
        .orderBy('ft.FeatureTypeDescription')
        .orderBy('fst.FeatureSubTypeDescription'),

      // All herbicides
      db.select('HerbicideDescription').from('LU_HERBICIDE').orderBy('HerbicideDescription'),

      // Point/line shared action list
      db
        .select({ action: 'a.ActionDescription' })
        .from({ a: 'LU_ACTION' })
        .join('FEATURE_ACTION as fa', 'fa.ActionID', 'a.ActionID')
        .where('fa.FeatureTypeID', POINT_LINE_FEATURE_TYPE_ID)
        .orderBy('a.ActionDescription'),

      // All feature types with their table association
      db
        .select({ description: 'FeatureTypeDescription', featureClass: db.raw('UPPER(TRIM(FeatureClassAssociation))') })
        .from('LU_FEATURETYPE')
        .orderBy('FeatureTypeDescription'),

      // Action-only polygon options for affected area
      db
        .select({ action: 'a.ActionDescription' })
        .from({ ft: 'LU_FEATURETYPE' })
        .join('FEATURE_ACTION as fa', 'fa.FeatureTypeID', 'ft.FeatureTypeID')
        .join('LU_ACTION as a', 'a.ActionID', 'fa.ActionID')
        .whereRaw('LOWER(ft.FeatureTypeDescription) = ?', [AFFECTED_AREA_FEATURE_TYPE])
        .orderBy('a.ActionDescription'),
    ]);

    logger.debug('editingDomains query results', {
      polyRows: polyRows.length,
      pointLineRows: pointLineRows.length,
      herbicideRows: herbicideRows.length,
      actionRows: actionRows.length,
      affectedAreaActionRows: affectedAreaActionRows.length,
    });

    // Build poly featureAttributes: { [category]: { [action]: string[] } }
    const featureAttributes: Record<string, PolyFeatureAttributes | string[]> = {};

    for (const row of polyRows as { category: string; action: string; treatment: string }[]) {
      const attrs = (featureAttributes[row.category] as PolyFeatureAttributes) ?? {};
      featureAttributes[row.category] = attrs;
      if (!attrs[row.action]) {
        attrs[row.action] = [];
      }
      const treatments = attrs[row.action]!;
      if (!treatments.includes(row.treatment)) {
        treatments.push(row.treatment);
      }
    }

    // Build point/line featureAttributes: { [category]: string[] }
    for (const row of pointLineRows as { category: string; subtype: string | null }[]) {
      if (!featureAttributes[row.category]) {
        featureAttributes[row.category] = [];
      }
      if (row.subtype && !(featureAttributes[row.category] as string[]).includes(row.subtype)) {
        (featureAttributes[row.category] as string[]).push(row.subtype);
      }
    }

    if (!featureAttributes[AFFECTED_AREA_FEATURE_TYPE]) {
      featureAttributes[AFFECTED_AREA_FEATURE_TYPE] = {};
    }

    const result: EditingDomainsResponse = {
      featureTypes: Object.fromEntries(
        (featureTypeRows as { description: string; featureClass: string }[]).map((r) => [
          r.description,
          r.featureClass as FeatureTable,
        ]),
      ),
      featureAttributes: sortRecordByKey(featureAttributes) as EditingDomainsResponse['featureAttributes'],
      affectedAreaActions: affectedAreaActionRows.map((r: { action: string }) => r.action),
      herbicides: herbicideRows.map((r: { HerbicideDescription: string }) => r.HerbicideDescription),
      pointLineActions: actionRows.map((r: { action: string }) => r.action),
    };

    return result;
  } catch (error) {
    logger.error('Error fetching editing domains:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', 'Failed to fetch editing domains');
  }
};
