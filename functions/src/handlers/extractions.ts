import * as areaOperator from '@arcgis/core/geometry/operators/areaOperator.js';
import * as intersectionOperator from '@arcgis/core/geometry/operators/intersectionOperator.js';
import * as lengthOperator from '@arcgis/core/geometry/operators/lengthOperator.js';
import * as projectOperator from '@arcgis/core/geometry/operators/projectOperator.js';
import * as unionOperator from '@arcgis/core/geometry/operators/unionOperator.js';
import Point from '@arcgis/core/geometry/Point.js';
import Polygon from '@arcgis/core/geometry/Polygon.js';
import Polyline from '@arcgis/core/geometry/Polyline.js';
import SpatialReference from '@arcgis/core/geometry/SpatialReference.js';
import * as logger from 'firebase-functions/logger';

export type GeometryJSON =
  | (__esri.PolygonProperties & { type: 'polygon' })
  | (__esri.PolylineProperties & { type: 'polyline' })
  | (__esri.PointProperties & { type: 'point' });
export type FeatureJSON = Pick<__esri.GraphicProperties, 'attributes' | 'geometry'> & {
  geometry: GeometryJSON;
};
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
  WEB_MERCATOR: 3857,
  UTM_ZONE_12N: 26912,
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
export type QueryResponse = Pick<__esri.FeatureSetProperties, 'features' | 'geometryType' | 'spatialReference'> & {
  features: FeatureJSON[];
};
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
 * @param serviceUrl - URL of the feature service layer
 * @param geometry - Input geometry to query against
 * @param outFields - Array of field names to return
 * @returns Query response with features
 */
export async function queryFeatureService(
  serviceUrl: string,
  geometry: GeometryJSON,
  outFields: string[],
): Promise<QueryResponse> {
  const params = new URLSearchParams({
    f: 'json',
    geometry: JSON.stringify(geometry),
    geometryType: getGeometryType(geometry),
    spatialRel: 'esriSpatialRelIntersects',
    outFields: outFields.join(','),
    returnGeometry: 'true',
    outSR: String(SPATIAL_REFERENCES.UTM_ZONE_12N),
  });

  const url = `${serviceUrl}/query?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Feature service query failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as __esri.FeatureSetProperties | { error: { message?: string } };

  if ('error' in data) {
    throw new Error(`Feature service error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data as QueryResponse;
}

/**
 * Determines the Esri geometry type from a geometry object
 */
function getGeometryType(geometry: GeometryJSON): string {
  switch (geometry.type.toLowerCase()) {
    case 'polygon':
      return 'esriGeometryPolygon';
    case 'polyline':
      return 'esriGeometryPolyline';
    case 'point':
      return 'esriGeometryPoint';
    default:
      throw new Error(`Unsupported geometry type: ${geometry.type}`);
  }
}

/**
 * Converts Esri JSON geometry to ArcGIS SDK geometry
 */
function esriJsonToGeometry(esriJson: GeometryJSON, spatialReference: SpatialReference): Polygon | Polyline | Point {
  if ('rings' in esriJson && esriJson.rings) {
    return new Polygon({
      rings: esriJson.rings,
      spatialReference,
    });
  }

  if ('paths' in esriJson && esriJson.paths) {
    return new Polyline({
      paths: esriJson.paths,
      spatialReference,
    });
  }

  if ('x' in esriJson && 'y' in esriJson && esriJson.x !== undefined && esriJson.y !== undefined) {
    return new Point({
      x: esriJson.x,
      y: esriJson.y,
      spatialReference,
    });
  }

  throw new Error('Unsupported geometry type for conversion');
}

/**
 * Converts ArcGIS SDK geometry to Esri JSON
 */
function geometryToEsriJson(geometry: Polygon | Polyline | Point): GeometryJSON {
  const json = geometry.toJSON();
  const type = geometry.type === 'polygon' ? 'polygon' : geometry.type === 'polyline' ? 'polyline' : 'point';

  return {
    ...json,
    type,
    spatialReference: {
      wkid: geometry.spatialReference.wkid,
    },
  } as GeometryJSON;
}

/**
 * Projects geometries to a different spatial reference using client-side projection
 * @param geometries - Array of geometries to project
 * @param fromSR - Source spatial reference
 * @param toSR - Target spatial reference
 * @returns Projected geometries
 */
export async function projectGeometries(
  geometries: GeometryJSON[],
  fromSR: number,
  toSR: number,
): Promise<GeometryJSON[]> {
  logger.debug('Projecting geometries', { fromSR, toSR });

  // Load projection engine
  await projectOperator.load();

  const fromSpatialRef = new SpatialReference({ wkid: fromSR });
  const toSpatialRef = new SpatialReference({ wkid: toSR });

  return geometries.map((geom) => {
    const sdkGeom = esriJsonToGeometry(geom, fromSpatialRef);
    const projected = projectOperator.execute(sdkGeom, toSpatialRef);

    if (!projected) {
      throw new Error('Projection failed');
    }

    return geometryToEsriJson(projected as Polygon | Polyline | Point);
  });
}

/**
 * Unions multiple geometries into a single geometry using client-side union operator
 * @param geometries - Array of geometries to union
 * @returns Unioned geometry
 */
export async function unionGeometries(geometries: GeometryJSON[]): Promise<GeometryJSON | null> {
  if (geometries.length === 0) {
    return null;
  }

  if (geometries.length === 1) {
    return geometries[0] || null;
  }

  logger.debug('Unioning geometries', { count: geometries.length });

  const spatialRef = new SpatialReference({ wkid: SPATIAL_REFERENCES.UTM_ZONE_12N });
  const sdkGeometries = geometries.map((g) => esriJsonToGeometry(g, spatialRef));

  // Union geometries pairwise
  let unioned = sdkGeometries[0];
  for (let i = 1; i < sdkGeometries.length; i++) {
    const nextGeom = sdkGeometries[i];

    if (!unioned || !nextGeom) {
      return null;
    }

    const result = unionOperator.execute(unioned, nextGeom);

    if (!result) {
      return null;
    }
    unioned = result as Polygon | Polyline | Point;
  }

  return geometryToEsriJson(unioned as Polygon | Polyline | Point);
}

/**
 * Calculates the intersection of two geometries using client-side intersection operator
 * @param geometry1 - First geometry
 * @param geometry2 - Second geometry
 * @param spatialReference - Spatial reference for the operation
 * @returns Array of intersection geometries
 */
export async function calculateIntersection(
  geometry1: GeometryJSON,
  geometry2: GeometryJSON,
  spatialReference: number = SPATIAL_REFERENCES.WEB_MERCATOR,
): Promise<GeometryJSON[]> {
  // If target SR is different from input, project first
  const inputSR = geometry1.spatialReference?.wkid || SPATIAL_REFERENCES.WEB_MERCATOR;

  let projectedGeometry1 = geometry1;
  let projectedGeometry2 = geometry2;

  if (inputSR !== spatialReference) {
    logger.debug('Projecting geometries before intersection', { from: inputSR, to: spatialReference });

    const projected1Results = await projectGeometries([geometry1], inputSR, spatialReference);
    const projected2Results = await projectGeometries([geometry2], inputSR, spatialReference);

    if (!projected1Results[0] || !projected2Results[0]) {
      throw new Error('Projection failed to return geometries');
    }

    projectedGeometry1 = projected1Results[0];
    projectedGeometry2 = projected2Results[0];
  }

  logger.debug('Calculating intersection');

  const spatialRef = new SpatialReference({ wkid: spatialReference });
  const sdkGeom1 = esriJsonToGeometry(projectedGeometry1, spatialRef);
  const sdkGeom2 = esriJsonToGeometry(projectedGeometry2, spatialRef);

  const intersection = intersectionOperator.execute(sdkGeom1, sdkGeom2);

  if (!intersection) {
    return [];
  }

  return [geometryToEsriJson(intersection as Polygon | Polyline | Point)];
}

/**
 * Calculates areas and lengths for geometries using client-side measurement operators
 * @param geometries - Array of geometries to measure
 * @param geometryType - Type of geometries
 * @returns Areas (for polygons) and lengths (for polylines) in UTM meters
 */
export async function calculateAreasAndLengths(
  geometries: GeometryJSON[],
  geometryType: string,
): Promise<AreasAndLengthsResponse> {
  logger.debug('Calculating areas and lengths');

  const spatialRef = new SpatialReference({ wkid: SPATIAL_REFERENCES.UTM_ZONE_12N });

  if (geometryType === 'esriGeometryPolygon') {
    const areas = geometries.map((geom) => {
      const polygon = esriJsonToGeometry(geom, spatialRef) as Polygon;

      return areaOperator.execute(polygon, { unit: 'square-meters' });
    });

    return { areas };
  }

  if (geometryType === 'esriGeometryPolyline') {
    const lengths = geometries.map((geom) => {
      const polyline = esriJsonToGeometry(geom, spatialRef) as Polyline;

      return lengthOperator.execute(polyline, { unit: 'meters' });
    });

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
 * @param geometry - User input geometry (polygon or polyline) in Esri JSON format
 * @param criteria - Criteria specifying which layers to query and what attributes to return
 * @returns Intersection results grouped by layer
 */
export async function extractIntersections(
  geometry: GeometryJSON,
  criteria: ExtractionCriteria,
): Promise<IntersectionResponse> {
  logger.info('Starting intersection extraction', { criteria });

  const results: IntersectionResponse = {};
  const geometryType = getGeometryType(geometry);

  // Ensure geometry has spatial reference
  if (!geometry.spatialReference) {
    geometry.spatialReference = { wkid: SPATIAL_REFERENCES.WEB_MERCATOR };
  }

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
      // Query the feature service with input geometry in Web Mercator (3857)
      // Response features are returned in UTM Zone 12N (26912) as specified by outSR parameter
      const queryResponse = await queryFeatureService(config.url, geometry, layerCriteria.attributes);

      if (!queryResponse.features || queryResponse.features.length === 0) {
        logger.debug(`No intersections found for layer: ${layer}`);
        continue;
      }

      logger.debug(`Found ${queryResponse.features.length} intersecting features for layer: ${layer}`);

      // Project input geometry from Web Mercator (3857) to UTM Zone 12N (26912)
      const [projectedInputGeometry] = await projectGeometries(
        [geometry],
        SPATIAL_REFERENCES.WEB_MERCATOR,
        SPATIAL_REFERENCES.UTM_ZONE_12N,
      );

      if (!projectedInputGeometry) {
        throw new Error('Failed to project input geometry to UTM');
      }

      logger.debug('Input geometry projected to UTM');

      // Process each feature - calculate intersections in UTM Zone 12N
      const layerResults: Array<{ geometry: GeometryJSON; attributes: Record<string, string | number> }> = [];

      for (const feature of queryResponse.features) {
        if (!feature || !feature.geometry) {
          logger.warn('Skipping feature with missing data');

          continue;
        }

        // Calculate intersection geometry (both geometries are in UTM 26912)
        const intersections = await calculateIntersection(
          projectedInputGeometry,
          feature.geometry,
          SPATIAL_REFERENCES.UTM_ZONE_12N,
        );

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
        { geometries: GeometryJSON[]; attributes: Record<string, string | number> }
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

      // Determine dimension for measurement based on input geometry type
      const isPolygonInput = geometryType === 'esriGeometryPolygon';
      const measureGeometryType = isPolygonInput ? 'esriGeometryPolygon' : 'esriGeometryPolyline';

      for (const [, group] of groupedByAttributes) {
        let finalGeometry: GeometryJSON | null = null;

        if (group.geometries.length === 1 && group.geometries[0]) {
          // Single geometry, no need to union
          finalGeometry = group.geometries[0];
        } else if (group.geometries.length > 0) {
          // Multiple geometries with same attributes - union them
          logger.debug(`Unioning ${group.geometries.length} geometries for feature`, { attributes: group.attributes });

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
        if (isPolygonInput && measurements.areas && measurements.areas[0]) {
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
