import { describe, expect, it } from 'vitest';
import { getAllowedUploadGeometryTypes, getPolyDraftModeForUploadedGeometry } from './featureGeometryUpload';

describe('FeatureGeometryEditor upload helpers', () => {
  it('maps feature tables to allowed shapefile geometry types', () => {
    expect(getAllowedUploadGeometryTypes('POLY')).toEqual(['polygon', 'polyline']);
    expect(getAllowedUploadGeometryTypes('LINE')).toEqual(['polyline']);
    expect(getAllowedUploadGeometryTypes('POINT')).toEqual(['point', 'multipoint']);
  });

  it('uses buffered-line mode when a polygon feature uploads line geometry', () => {
    expect(getPolyDraftModeForUploadedGeometry('POLY', 'polyline')).toBe('buffered-line');
  });

  it('keeps polygon mode for non-line uploads and non-polygon tables', () => {
    expect(getPolyDraftModeForUploadedGeometry('POLY', 'polygon')).toBe('polygon');
    expect(getPolyDraftModeForUploadedGeometry('LINE', 'polyline')).toBe('polygon');
    expect(getPolyDraftModeForUploadedGeometry('POINT', 'multipoint')).toBe('polygon');
  });
});
