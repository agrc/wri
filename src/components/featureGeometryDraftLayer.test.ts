import Point from '@arcgis/core/geometry/Point.js';
import Polygon from '@arcgis/core/geometry/Polygon.js';
import Polyline from '@arcgis/core/geometry/Polyline.js';
import Graphic from '@arcgis/core/Graphic.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js';
import { describe, expect, it } from 'vitest';
import {
  createDraftGraphic,
  getDraftGeometriesFromGraphics,
  replaceDraftLayerGeometries,
} from './featureGeometryDraftLayer';

describe('featureGeometryDraftLayer', () => {
  it('creates a draft graphic with the provided symbol factory', () => {
    const geometry = new Point({ x: 1, y: 2, spatialReference: { wkid: 3857 } });
    const symbol = new SimpleFillSymbol();
    const graphic = createDraftGraphic(geometry, () => symbol);

    expect(graphic.geometry).toBe(geometry);
    expect(graphic.symbol).toBe(symbol);
  });

  it('reads geometries from graphics and excludes a transient graphic when requested', () => {
    const keptGraphic = new Graphic({
      geometry: new Polygon({
        rings: [
          [
            [0, 0],
            [0, 2],
            [2, 2],
            [2, 0],
            [0, 0],
          ],
        ],
        spatialReference: { wkid: 3857 },
      }),
    });
    const excludedGraphic = new Graphic({
      geometry: new Polyline({
        paths: [
          [
            [5, 5],
            [6, 6],
          ],
        ],
        spatialReference: { wkid: 3857 },
      }),
    });

    const geometries = getDraftGeometriesFromGraphics([keptGraphic, excludedGraphic], {
      excludeGraphic: excludedGraphic,
    });

    expect(geometries).toEqual([keptGraphic.geometry]);
  });

  it('replaces layer graphics using the supplied symbol factory', () => {
    const graphicsLayer = new GraphicsLayer();
    const originalGraphic = new Graphic({
      geometry: new Point({ x: 0, y: 0, spatialReference: { wkid: 3857 } }),
    });
    const symbol = new SimpleFillSymbol();
    const nextGeometry = new Polygon({
      rings: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
      spatialReference: { wkid: 3857 },
    });

    graphicsLayer.add(originalGraphic);

    replaceDraftLayerGeometries(graphicsLayer, [nextGeometry], () => symbol);

    expect(graphicsLayer.graphics.length).toBe(1);
    expect(graphicsLayer.graphics.getItemAt(0)?.geometry).toBe(nextGeometry);
    expect(graphicsLayer.graphics.getItemAt(0)?.symbol).toBe(symbol);
  });
});
