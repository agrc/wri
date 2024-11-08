import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import UniqueValueInfo from '@arcgis/core/renderers/support/UniqueValueInfo';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';

const config = {
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
      id: 'reference-land-ownership',
      type: 'renderer',
      renderer: new UniqueValueRenderer({
        field: 'state_lgd',
        uniqueValueInfos: [
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [254, 230, 121, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'Bureau of Land Management',
            label: 'Bureau of Land Management',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [255, 255, 179, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'Bureau of Reclamation',
            label: 'Bureau of Reclamation',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [252, 205, 207, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'Bankhead-Jones Land Use Lands',
            label: 'Bankhead-Jones Land Use Lands',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [205, 137, 102, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'National Recreation Area',
            label: 'National Recreation Area',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [202, 166, 222, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'National Historic Sites',
            label: 'National Parks & Historic Sites',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [154, 84, 204, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'National Monument',
            label: 'National Monument',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [137, 205, 102, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'National Forest',
            label: 'National Forest',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [38, 115, 0, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'National Wilderness Area',
            label: 'National Wilderness Area',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [127, 204, 167, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'National Wildlife Refuge',
            label: 'National Wildlife Refuge',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [230, 204, 179, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'Other Federal',
            label: 'Other Federal',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [251, 180, 206, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'Military Reservations and Corps of Engineers',
            label: 'Military Reservations and Corps of Engineers',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [240, 240, 240, 0],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'Private',
            label: 'Private',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [115, 178, 255, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'State Trust Lands',
            label: 'State Trust Lands',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [173, 201, 222, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'State Sovereign Land',
            label: 'State Sovereign Land',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [136, 147, 186, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'State Parks and Recreation',
            label: 'State Parks and Recreation',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [194, 184, 143, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'State Wildlife Reserve/Management Area',
            label: 'State Wildlife Reserve/Management Area',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [190, 255, 232, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'Other State',
            label: 'Other State',
          }),
          new UniqueValueInfo({
            symbol: new SimpleFillSymbol({
              style: 'solid',
              color: [253, 180, 108, 255],
              outline: new SimpleLineSymbol({
                style: 'solid',
                color: [178, 178, 178, 255],
                width: 0.5,
              }),
            }),
            value: 'Tribal Lands',
            label: 'Tribal Lands',
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

export default config;
