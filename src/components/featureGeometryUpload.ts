import type Geometry from '@arcgis/core/geometry/Geometry';
import type { FeatureTable } from '@ugrc/wri-shared/types';
import type { AllowedGeometryType } from '../hooks/useShapefileUpload';

export type PolyDraftMode = 'polygon' | 'buffered-line';

export const getAllowedUploadGeometryTypes = (table: FeatureTable): AllowedGeometryType[] => {
  switch (table) {
    case 'POLY':
      return ['polygon', 'polyline'];
    case 'LINE':
      return ['polyline'];
    case 'POINT':
      return ['point', 'multipoint'];
    default:
      return [];
  }
};

export const getPolyDraftModeForUploadedGeometry = (
  table: FeatureTable,
  geometryType: Geometry['type'],
): PolyDraftMode => {
  if (table === 'POLY' && geometryType === 'polyline') {
    return 'buffered-line';
  }

  return 'polygon';
};
