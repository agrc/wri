import type Geometry from '@arcgis/core/geometry/Geometry.js';
import Graphic from '@arcgis/core/Graphic.js';
import type GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';

type DraftSymbol = Graphic['symbol'];

export const createDraftGraphic = (
  geometry: Geometry,
  getSymbol: (geometry: Geometry) => DraftSymbol | undefined,
): Graphic => {
  return new Graphic({
    geometry,
    symbol: getSymbol(geometry),
  });
};

export const getDraftGeometriesFromGraphics = (
  graphics: Graphic[],
  options: { excludeGraphic?: Graphic | null } = {},
): Geometry[] => {
  const { excludeGraphic = null } = options;

  return graphics
    .filter((graphic): graphic is Graphic & { geometry: Geometry } => {
      return graphic !== excludeGraphic && graphic.geometry != null;
    })
    .map((graphic) => graphic.geometry);
};

export const replaceDraftLayerGeometries = (
  graphicsLayer: GraphicsLayer,
  geometries: Geometry[],
  getSymbol: (geometry: Geometry) => DraftSymbol | undefined,
): void => {
  graphicsLayer.removeAll();

  if (geometries.length === 0) {
    return;
  }

  graphicsLayer.addMany(geometries.map((geometry) => createDraftGraphic(geometry, getSymbol)));
};