import Multipoint from '@arcgis/core/geometry/Multipoint';
import Point from '@arcgis/core/geometry/Point';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import * as projectOperator from '@arcgis/core/geometry/operators/projectOperator';
import * as unionOperator from '@arcgis/core/geometry/operators/unionOperator';
import { fromJSON as geometryFromJSON } from '@arcgis/core/geometry/support/jsonUtils';
import { arcgisToGeoJSON, geojsonToArcGIS } from '@terraformer/arcgis';
import { geoJSONToWkt } from 'betterknown';
import type { FeatureCollection } from 'geojson';
import { useCallback, useState } from 'react';
import shp from 'shpjs';

type AllowedGeometryType = 'point' | 'multipoint' | 'polyline' | 'polygon';

type UseShapefileUploadOptions = {
  allowedGeometryTypes?: AllowedGeometryType[];
  onSuccess: (payload: { geometry: __esri.Geometry; wkt3857: string }) => void;
};

type UseShapefileUploadResult = {
  error: string | null;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isLoading: boolean;
};

const WEB_MERCATOR = new SpatialReference({ wkid: 3857 });
const ZIP_FILE_ERROR = 'Please upload a .zip file that contains a shapefile.';
const UNSUPPORTED_GEOMETRY_ERROR = 'Unsupported geometry type in shapefile.';
const EMPTY_FILE_ERROR = 'No features were found in the provided shapefile.';

const DEFAULT_ALLOWED_TYPES: AllowedGeometryType[] = ['polygon', 'polyline', 'point', 'multipoint'];

type FeatureCollectionWithCrs = FeatureCollection & {
  crs?: {
    properties?: {
      name?: string;
    };
  };
};

const getSpatialReferenceFromGeoJSON = (geojson: FeatureCollectionWithCrs): SpatialReference => {
  const name = geojson?.crs?.properties?.name;

  if (!name) {
    return SpatialReference.WGS84;
  }

  const match = name.match(/EPSG::?(\d+)/i);
  if (match?.[1]) {
    return new SpatialReference({ wkid: Number(match[1]) });
  }

  return SpatialReference.WGS84;
};

const ensureSpatialReference = (geometry: __esri.Geometry, fallback: SpatialReference) => {
  if (!geometry.spatialReference) {
    geometry.spatialReference = fallback;
  }
};

const combinePoints = (geometries: __esri.Geometry[]): Multipoint => {
  const points: number[][] = [];

  geometries.forEach((geometry) => {
    if (geometry.type === 'multipoint') {
      const multipoint = geometry as unknown as __esri.Multipoint;
      points.push(...multipoint.points);
    } else {
      const point = geometry as Point;
      points.push([point.x, point.y]);
    }
  });

  return new Multipoint({
    points,
    spatialReference: WEB_MERCATOR,
  });
};

/**
 * React hook for uploading and parsing shapefiles (.zip) and extracting geometry.
 *
 * @param {UseShapefileUploadOptions} options - Configuration options for the hook.
 * @param {AllowedGeometryType[]} [options.allowedGeometryTypes] - Array of allowed geometry types ('point', 'multipoint', 'polyline', 'polygon'). Defaults to all.
 * @param {(payload: { geometry: __esri.Geometry; wkt3857: string }) => void} options.onSuccess - Callback invoked when a shapefile is successfully parsed.
 *   - `geometry`: The parsed geometry in ArcGIS format, projected to Web Mercator (EPSG:3857).
 *   - `wkt3857`: The geometry as a WKT string in EPSG:3857.
 *
 * @returns {UseShapefileUploadResult} Object containing:
 *   - `error`: Error message if upload or parsing fails, otherwise null.
 *   - `handleFileChange`: Function to handle file input change events.
 *   - `isLoading`: Boolean indicating if the upload/parsing is in progress.
 *
 * @example
 * const { error, handleFileChange, isLoading } = useShapefileUpload({
 *   allowedGeometryTypes: ['polygon'],
 *   onSuccess: ({ geometry, wkt3857 }) => {
 *     // Use geometry and WKT string
 *   },
 * });
 *
 * The hook expects a .zip file containing a valid ESRI Shapefile. The shapefile should contain features of the allowed geometry types.
 * If the shapefile contains unsupported geometry types or no features, an error will be returned.
 */

const useShapefileUpload = (options: UseShapefileUploadOptions): UseShapefileUploadResult => {
  const { allowedGeometryTypes = DEFAULT_ALLOWED_TYPES, onSuccess } = options;

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError(ZIP_FILE_ERROR);
        event.target.value = '';
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const geojson = (await shp(arrayBuffer)) as FeatureCollectionWithCrs;

        if (!geojson?.features?.length) {
          throw new Error(EMPTY_FILE_ERROR);
        }

        const sourceSpatialReference = getSpatialReferenceFromGeoJSON(geojson);
        const arcgisFeatures = geojsonToArcGIS(geojson) as Array<{ geometry: ReturnType<__esri.Geometry['toJSON']> }>;

        if (!projectOperator.isLoaded()) {
          await projectOperator.load();
        }
        const esriGeometries = arcgisFeatures.reduce<__esri.Geometry[]>((acc, feature) => {
          const geometry = geometryFromJSON(feature.geometry);
          if (geometry) {
            ensureSpatialReference(geometry, sourceSpatialReference);
            if (geometry.spatialReference?.wkid === WEB_MERCATOR.wkid) {
              acc.push(geometry);

              return acc;
            }

            const projected = projectOperator.execute(geometry, WEB_MERCATOR);

            if (!projected) {
              throw new Error('Unable to project shapefile geometry to Web Mercator (EPSG:3857).');
            }

            acc.push(projected);
          }

          return acc;
        }, []);

        if (!esriGeometries.length) {
          throw new Error(EMPTY_FILE_ERROR);
        }

        const geometryType = (esriGeometries[0]?.type ?? 'polygon') as AllowedGeometryType;

        if (!allowedGeometryTypes.includes(geometryType)) {
          throw new Error(UNSUPPORTED_GEOMETRY_ERROR);
        }

        let unionedGeometry: __esri.Geometry | nullish = null;
        const firstProjectedGeometry = esriGeometries[0];

        if (geometryType === 'point' || geometryType === 'multipoint') {
          unionedGeometry = combinePoints(esriGeometries);
        } else if (geometryType === 'polygon' || geometryType === 'polyline') {
          unionedGeometry =
            esriGeometries.length === 1
              ? firstProjectedGeometry
              : (unionOperator.executeMany(esriGeometries as __esri.GeometryUnion[]) as __esri.Geometry);
        }

        if (!unionedGeometry) {
          throw new Error('Failed to combine shapefile geometries.');
        }

        const geoJsonGeometry = arcgisToGeoJSON(unionedGeometry.toJSON());
        const wkt3857 = geoJSONToWkt(geoJsonGeometry);

        onSuccess({ geometry: unionedGeometry, wkt3857 });
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : 'Failed to process shapefile upload.';
        setError(message);
      } finally {
        setIsLoading(false);
        event.target.value = '';
      }
    },
    [allowedGeometryTypes, onSuccess],
  );

  return {
    error,
    handleFileChange,
    isLoading,
  };
};

export { useShapefileUpload };
