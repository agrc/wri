import { execute as area } from '@arcgis/core/geometry/operators/areaOperator.js';
import { accelerateGeometry, execute as intersect } from '@arcgis/core/geometry/operators/intersectionOperator.js';
import { execute as length } from '@arcgis/core/geometry/operators/lengthOperator.js';
import {
  isLoaded as projectIsLoaded,
  load as projectLoad,
  executeMany as projectMany,
} from '@arcgis/core/geometry/operators/projectOperator.js';
import { execute as union } from '@arcgis/core/geometry/operators/unionOperator.js';
import Point from '@arcgis/core/geometry/Point.js';
import Polygon from '@arcgis/core/geometry/Polygon.js';
import Polyline from '@arcgis/core/geometry/Polyline.js';
import SpatialReference from '@arcgis/core/geometry/SpatialReference.js';
import { fromJSON as geometryFromJSON, getJsonType } from '@arcgis/core/geometry/support/jsonUtils.js';
import Graphic from '@arcgis/core/Graphic.js';
import type { GeometryUnion } from '@arcgis/core/unionTypes.js';
import type { IQueryFeaturesOptions, IQueryFeaturesResponse } from '@esri/arcgis-rest-feature-service';
import { queryFeatures } from '@esri/arcgis-rest-feature-service';
import type { IFeature, IGeometry } from '@esri/arcgis-rest-request';
import * as logger from 'firebase-functions/logger';
import ky from 'ky';

// Use a params shape that matches the query options except `url` (we add the URL later)
type QueryParams = Omit<IQueryFeaturesOptions, 'url'>;

const httpClient = ky.create({
  timeout: 30000,
  retry: {
    limit: 3,
    jitter: true,
    methods: ['get'],
  },
});

async function kyRequestAdapter(url: string, requestOptions?: Record<string, unknown>) {
  const opts = requestOptions || {};

  const params = (opts as unknown as { params?: Record<string, string | number | boolean> }).params;

  if (params) {
    if ('geometry' in params) {
      const g = params.geometry as unknown;
      if (g && typeof (g as { toJSON?: unknown }).toJSON === 'function') {
        params.geometry = JSON.stringify((g as { toJSON: () => unknown }).toJSON());
      } else {
        params.geometry = JSON.stringify(g as object);
      }
    }

    if ('outSR' in params) {
      params.outSR = (params.outSR as SpatialReference).wkid.toString();
    }
  }

  const response = await httpClient.get(url, {
    searchParams: params as Record<string, string | number | boolean> | undefined,
  });

  if ((opts as unknown as { rawResponse?: boolean }).rawResponse) {
    return response;
  }

  return response.json();
}

export const FEATURE_SERVICE_CONFIG = {
  county: {
    url: 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahCountyBoundaries/FeatureServer/0',
    attributes: ['NAME'] as const,
    nameField: 'NAME',
  },
  landowner: {
    url: 'https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership/FeatureServer/0',
    attributes: ['owner', 'admin'] as const,
    nameField: 'owner',
    extraField: 'admin',
  },
  sgma: {
    url: 'https://dwrmapserv.utah.gov/dwrarcgis/rest/services/Sage_grouse/SGMA_outlines/FeatureServer/0',
    attributes: ['Area_name'] as const,
    nameField: 'Area_name',
  },
  stream: {
    url: 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahStreamsNHD/FeatureServer/0',
    attributes: ['FCode_Text'] as const,
    nameField: 'FCode_Text',
  },
} as const;
export type LayerName = keyof typeof FEATURE_SERVICE_CONFIG;
export const SPATIAL_REFERENCES = {
  WEB_MERCATOR: SpatialReference.WebMercator,
  UTM_ZONE_12N: new SpatialReference({ wkid: 26912 }),
} as const;
export interface LayerCriteria {
  attributes: string[];
}
export type ExtractionCriteria = Partial<Record<LayerName, LayerCriteria>>;
export interface IntersectionResult {
  [key: string]: string | number;
  size: number;
  displaySize: string;
}
export type IntersectionResponse = Partial<Record<LayerName, IntersectionResult[]>>;
export type QueryResponse = IQueryFeaturesResponse;
export interface AreasAndLengthsResponse {
  areas?: number[];
  lengths?: number[];
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Queries an ArcGIS feature service for features intersecting a geometry
 * Handles pagination to retrieve all results if exceeding maxRecordCount
 * @param serviceUrl - URL of the feature service layer
 * @param intersectionGeometry - Input geometry to filter with, one of the WRI feature types, multipoint, line, and polygon
 * @param outFields - Array of field names to return
 * @returns Query response with features
 */
export async function queryFeatureService(
  serviceUrl: string,
  intersectionGeometry: Polygon | Polyline | Point,
  outFields: string[],
): Promise<IQueryFeaturesResponse> {
  const baseParams = {
    f: 'json',
    geometry: intersectionGeometry,
    geometryType: getJsonType(intersectionGeometry),
    spatialRel: 'esriSpatialRelIntersects',
    outFields: outFields,
    returnGeometry: true,
    outSR: SPATIAL_REFERENCES.UTM_ZONE_12N,
  } satisfies QueryParams;

  let allFeatures: IFeature[] = [];
  let resultOffset = 0;
  let exceededTransferLimit = true;

  while (exceededTransferLimit) {
    const featureSet = (await queryFeatures({
      url: serviceUrl,
      ...baseParams,
      resultOffset,
      request: kyRequestAdapter,
    } as IQueryFeaturesOptions)) as IQueryFeaturesResponse;

    allFeatures = allFeatures.concat(featureSet.features || []);
    exceededTransferLimit = featureSet.exceededTransferLimit || false;

    if (exceededTransferLimit) {
      logger.debug(`Fetching more features from offset ${resultOffset}`);

      resultOffset += (featureSet.features && featureSet.features.length) || 0;
    }
  }

  logger.debug(`Retrieved ${allFeatures.length} total features from ${serviceUrl}`);

  const converted = allFeatures.map((feature) => {
    const geometry = geometryFromJSON(feature.geometry as IFeature['geometry'] | IGeometry);
    geometry.spatialReference = SPATIAL_REFERENCES.UTM_ZONE_12N;

    return new Graphic({ ...feature, geometry });
  });

  return { features: converted } as IQueryFeaturesResponse;
}

/**
 * Projects geometries to a different spatial reference using client-side projection
 * @param geometries - Array of geometries to project
 * @param toSR - Target spatial reference
 * @returns Projected geometries
 */
export async function projectGeometries(
  geometries: Array<GeometryUnion>,
  toSR: SpatialReference,
): Promise<Array<GeometryUnion>> {
  logger.debug('Projecting geometries', { toSR });

  if (!projectIsLoaded()) {
    await projectLoad();
  }

  const result = (await projectMany(geometries, toSR)) as Array<GeometryUnion | null | undefined>;

  return result;
}

/**
 * Unions multiple geometries into a single geometry using client-side union operator
 * @param geometries - Array of geometries to union
 * @returns Unioned geometry
 */
export async function unionGeometries(geometries: Array<GeometryUnion>): Promise<GeometryUnion | null> {
  if (geometries.length === 0) {
    return null;
  }

  if (geometries.length === 1) {
    return geometries[0] || null;
  }

  logger.debug('Performing a union on geometries', { count: geometries.length });

  // Union geometries pairwise
  let unioned = geometries[0];
  for (let i = 1; i < geometries.length; i++) {
    const nextGeom = geometries[i];

    if (!unioned || !nextGeom) {
      return null;
    }

    const result = union(unioned, nextGeom);

    if (!result) {
      return null;
    }

    unioned = result;
  }

  return unioned;
}

/**
 * Calculates the intersection of two geometries using client-side intersection operator
 * @param clipGeometry - First geometry (accelerated)
 * @param inputGeometry - Second geometry
 * @returns Array of intersection geometries
 */
export async function calculateIntersection(
  clipGeometry: GeometryUnion,
  inputGeometry: GeometryUnion,
): Promise<Array<GeometryUnion>> {
  if (!clipGeometry || !inputGeometry) {
    throw new Error('Missing input geometry for intersection');
  }

  logger.debug('Calculating intersection');

  const intersection = intersect(inputGeometry, clipGeometry);

  if (!intersection) {
    return [];
  }

  return [intersection];
}

/**
 * Calculates areas and lengths for geometries using client-side measurement operators
 * @param geometries - Array of geometries to measure
 * @param geometryType - Type of geometries
 * @returns Areas (for polygons) and lengths (for polylines) in UTM meters
 */
export async function calculateAreasAndLengths(
  geometries: Array<IFeature['geometry'] | IGeometry>,
  geometryType: string,
): Promise<AreasAndLengthsResponse> {
  logger.debug('Calculating areas and lengths');

  if (geometryType === 'esriGeometryPolygon') {
    const areas = geometries.map((geom) => area(geom, { unit: 'square-meters' }));

    return { areas };
  }

  if (geometryType === 'esriGeometryPolyline') {
    const lengths = geometries.map((geom) => length(geom, { unit: 'meters' }));

    return { lengths };
  }

  return {};
}

/**
 * Converts square meters to acres with formatting
 * @param squareMeters - Area in square meters
 * @returns Formatted string (e.g., "1,234.56 ac")
 */
export function formatAcres(squareMeters: number): string {
  const acres = squareMeters * 0.000247105;

  if (acres < 0.01) {
    return '< 0.01 ac';
  }

  return `${numberFormatter.format(acres)} ac`;
}

/**
 * Converts meters to miles with formatting
 * @param meters - Length in meters
 * @returns Formatted string (e.g., "12.34 mi")
 */
export function formatMiles(meters: number): string {
  const miles = meters * 0.000621371;

  if (miles < 0.01) {
    return '< 0.01 mi';
  }

  return `${numberFormatter.format(miles)} mi`;
}

/**
 * Extracts intersection information for a user-provided geometry against reference layers
 * @param inputClipGeometry - User input geometry (polygon, polyline, or point) in Esri JSON format
 * @param criteria - Criteria specifying which layers to query and what attributes to return
 * @returns Intersection results grouped by layer
 */
export async function extractIntersections(
  inputClipGeometry: Polygon | Polyline | Point,
  criteria: ExtractionCriteria,
): Promise<IntersectionResponse> {
  logger.info('Starting intersection extraction', { criteria });

  const results: IntersectionResponse = {};

  if (!inputClipGeometry) {
    throw new Error('No input geometry provided');
  }

  inputClipGeometry = new Polygon({ ...inputClipGeometry });

  // Ensure geometry has spatial reference
  if (!inputClipGeometry.spatialReference) {
    inputClipGeometry.spatialReference = SPATIAL_REFERENCES.WEB_MERCATOR;
  }

  // Project clip geometry to UTM Zone 12N (26912)
  const clipGeometry = await projectGeometries([inputClipGeometry], SPATIAL_REFERENCES.UTM_ZONE_12N);

  if (!clipGeometry) {
    throw new Error('Failed to project input geometry to UTM');
  }

  await accelerateGeometry(clipGeometry[0]);

  // Process each layer in the criteria
  for (const [layerName, layerCriteria] of Object.entries(criteria)) {
    const layer = layerName as LayerName;
    const config = FEATURE_SERVICE_CONFIG[layer];

    if (!config) {
      logger.warn(`Unknown layer: ${layer}`);

      continue;
    }

    logger.debug(`Processing layer: ${layer}`);

    try {
      // Response features are returned in UTM Zone 12N (26912) as specified by outSR parameter
      const featureSet = await queryFeatureService(config.url, inputClipGeometry, layerCriteria.attributes);
      const graphics = (featureSet && (featureSet.features as Graphic[])) || [];

      if (graphics.length === 0) {
        logger.debug(`No intersections found for layer: ${layer}`);

        continue;
      }

      logger.debug(`Found ${graphics.length} intersecting features for layer: ${layer}`);

      // Process each feature - calculate intersections in UTM Zone 12N
      const layerResults: Array<{
        geometry: GeometryUnion;
        attributes: Record<string, string | number>;
      }> = [];

      for (const feature of graphics) {
        if (!feature || !feature.geometry) {
          logger.warn('Skipping feature with missing data');

          continue;
        }

        // Calculate intersection geometry (both geometries are in UTM 26912)
        const intersections = await calculateIntersection(clipGeometry[0], feature.geometry);

        if (intersections.length === 0 || !intersections[0]) {
          logger.debug(`No intersection geometry returned for feature`, {
            featureAttributes: feature.attributes,
          });

          continue;
        }

        logger.debug(`Intersection calculated`, {
          featureAttributes: feature.attributes,
          intersectionCount: intersections.length,
        });

        // Store intersection geometry with attributes for grouping
        const intersection = intersections[0];

        // Create attribute key for grouping (e.g., all attributes together)
        const attributeValues: Record<string, string | number> = {};
        for (const attr of layerCriteria.attributes) {
          const value = feature.attributes[attr];
          if (value !== null && value !== undefined) {
            attributeValues[attr.toLowerCase()] = value as string | number;
          }
        }

        layerResults.push({
          geometry: intersection,
          attributes: attributeValues,
        });
      }

      // Group intersection geometries by their attribute values
      const groupedByAttributes = new Map<
        string,
        { geometries: Array<GeometryUnion>; attributes: Record<string, string | number> }
      >();

      for (const result of layerResults) {
        // Create a key from all attribute values
        const key = JSON.stringify(result.attributes);

        if (!groupedByAttributes.has(key)) {
          groupedByAttributes.set(key, {
            geometries: [],
            attributes: result.attributes,
          });
        }

        groupedByAttributes.get(key)!.geometries.push(result.geometry);
      }

      logger.debug(`Grouped ${layerResults.length} intersections into ${groupedByAttributes.size} unique features`);

      // For each group, union the geometries and calculate total area/length
      const finalResults: IntersectionResult[] = [];

      // Determine dimension for measurement based on the layer's geometry type
      // Streams are polylines, everything else is polygons
      const isPolylineLayer = layer === 'stream';
      const measureGeometryType = isPolylineLayer ? 'esriGeometryPolyline' : 'esriGeometryPolygon';

      for (const [, group] of groupedByAttributes) {
        let finalGeometry: GeometryUnion | null = null;

        if (group.geometries.length === 1 && group.geometries[0]) {
          // Single geometry, no need to union
          finalGeometry = group.geometries[0];
        } else if (group.geometries.length > 0) {
          // Multiple geometries with same attributes - union them
          logger.debug(`Performing a union on ${group.geometries.length} geometries for feature`, {
            attributes: group.attributes,
          });

          // Union operation - start with first geometry and union with rest
          finalGeometry = await unionGeometries(group.geometries);

          if (!finalGeometry) {
            logger.warn('Union operation failed', { attributes: group.attributes });

            continue;
          }
        } else {
          logger.warn('No geometries to process for group', { attributes: group.attributes });

          continue;
        }

        // Calculate size of the final geometry
        const measurements = await calculateAreasAndLengths([finalGeometry], measureGeometryType);

        let size: number;
        let displaySize: string;
        if (!isPolylineLayer && measurements.areas && measurements.areas[0]) {
          const areaSquareMeters = Math.abs(measurements.areas[0]);

          size = areaSquareMeters * 0.000247105; // Convert to acres
          displaySize = formatAcres(areaSquareMeters);
        } else if (measurements.lengths && measurements.lengths[0]) {
          const lengthMeters = Math.abs(measurements.lengths[0]);

          size = lengthMeters * 0.000621371; // Convert to miles
          displaySize = formatMiles(lengthMeters);
        } else {
          logger.warn('No measurement calculated for final geometry', { attributes: group.attributes });

          continue;
        }

        finalResults.push({
          ...group.attributes,
          size,
          displaySize,
        });
      }

      if (finalResults.length > 0) {
        results[layer] = finalResults;
      }
    } catch (error) {
      logger.error(`Error processing layer ${layer}`, { error });

      throw error;
    }
  }

  logger.info('Intersection extraction complete', { layerCount: Object.keys(results).length });

  return results;
}
