import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import UniqueValueInfo from '@arcgis/core/renderers/support/UniqueValueInfo';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';

const config = {
  MAIN_MAP_COMPONENT_ID: 'wri-map',
  MIN_DESKTOP_WIDTH: 768,
  WEB_MERCATOR_WKID: 3857,
  MARKER_FILL_COLOR: [234, 202, 0, 0.5],
  MARKER_OUTLINE_COLOR: [77, 42, 84, 1],
  STATUS_COLORS: {
    Cancelled: [190, 30, 45, 255],
    Completed: [38, 147, 69, 255],
    Current: [33, 145, 174, 255],
    Draft: [131, 142, 142, 255],
    Pending: [204, 159, 43, 255],
    Proposed: [0, 0, 0, 255],
  },
  LEGEND_DATA: [
    {
      id: 'reference-fire-threat-index',
      type: 'renderer',
      renderer: new UniqueValueRenderer({
        field: 'threat',
        uniqueValueInfos: [
          new UniqueValueInfo({
            label: 'Very very low',
            value: 'Very very low',
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [151, 172, 129, 255],
            }),
          }),
          new UniqueValueInfo({
            label: 'Very low',
            value: 'Very low',
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [187, 214, 170, 255],
            }),
          }),
          new UniqueValueInfo({
            label: 'Low',
            value: 'Low',
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [215, 207, 161, 255],
            }),
          }),
          new UniqueValueInfo({
            label: 'Low to moderate',
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [255, 254, 193, 255],
            }),
            value: 'Low to moderate',
          }),
          new UniqueValueInfo({
            label: 'Moderate',
            value: 'Moderate',
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [254, 210, 133, 255],
            }),
          }),
          new UniqueValueInfo({
            label: 'Moderate to high',
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [253, 169, 41, 255],
            }),
            value: 'Moderate to high',
          }),
          new UniqueValueInfo({
            label: 'High',
            value: 'High',
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [253, 86, 31, 255],
            }),
          }),
          new UniqueValueInfo({
            label: 'Very high',
            value: 'Very high',
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [205, 8, 20, 255],
            }),
          }),
          new UniqueValueInfo({
            label: 'Extreme',
            value: 'Extreme',
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [114, 2, 6, 255],
            }),
          }),
        ],
      }),
    },
    {
      id: 'reference-plss',
      type: 'renderer',
      renderer: new SimpleRenderer({
        symbol: new SimpleFillSymbol({
          style: 'none',
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [165, 15, 21, 255],
            width: 2,
          }),
        }),
      }),
    },
  ],
};

export const getDraftPointSymbol = () =>
  new SimpleMarkerSymbol({
    style: 'circle',
    size: 10,
    color: config.MARKER_FILL_COLOR,
    outline: {
      color: config.MARKER_OUTLINE_COLOR,
      width: 1.5,
    },
  });

export const getDraftPolylineSymbol = () =>
  new SimpleLineSymbol({
    style: 'solid',
    color: config.MARKER_OUTLINE_COLOR,
    width: 2.5,
  });

export const getDraftPolygonSymbol = () =>
  new SimpleFillSymbol({
    style: 'solid',
    color: config.MARKER_FILL_COLOR,
    outline: new SimpleLineSymbol({
      style: 'solid',
      color: config.MARKER_OUTLINE_COLOR,
      width: 1.5,
    }),
  });

export default config;
