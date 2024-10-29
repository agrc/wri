import Extent from '@arcgis/core/geometry/Extent';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import EsriMap from '@arcgis/core/Map';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import ClassBreakInfo from '@arcgis/core/renderers/support/ClassBreakInfo';
import UniqueValueInfo from '@arcgis/core/renderers/support/UniqueValueInfo';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import SizeVariable from '@arcgis/core/renderers/visualVariables/SizeVariable';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import MapView from '@arcgis/core/views/MapView';

import LayerSelector from '@ugrc/layer-selector';
import { useMapReady } from '@ugrc/utilities/hooks';
import { useEffect, useRef, useState } from 'react';
import { useMap } from './hooks';

import '@ugrc/layer-selector/src/LayerSelector.css';

type LayerFactory = {
  Factory: new () => __esri.Layer;
  url: string;
  id: string;
  opacity: number;
};
type SelectorOptions = {
  view: MapView;
  quadWord: string;
  baseLayers: Array<string | { token: string; selected: boolean } | LayerFactory>;
  overlays?: Array<string | LayerFactory>;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
};

const statewide = new Extent({
  xmax: -11762120.612131765,
  xmin: -13074391.513731329,
  ymax: 5225035.106177688,
  ymin: 4373832.359194187,
  spatialReference: {
    wkid: 3857,
  },
});

const landOwnership = new VectorTileLayer({
  title: 'Land Ownership',
  id: 'reference-land-ownership',
  url: 'https://gis.trustlands.utah.gov/hosting/rest/services/Hosted/Land_Ownership_WM_VectorTile/VectorTileServer',
  visible: false,
  opacity: 0.3,
});
const plss = new VectorTileLayer({
  title: 'Utah PLSS',
  id: 'reference-plss',
  url: 'https://tiles.arcgis.com/tiles/99lidPhWCzftIe9K/arcgis/rest/services/UtahPLSS/VectorTileServer',
  visible: false,
  opacity: 0.9,
});
const streams = new FeatureLayer({
  title: 'NHD Streams',
  id: 'reference-streams',
  url: 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahStreamsNHD/FeatureServer/0',
  fields: ['GNIS_Name'],
  definitionExpression: 'InUtah = 1 AND Submerged = 0',
  visible: false,
  labelsVisible: false,
  opacity: 0.7,
  minScale: 80000,
  maxScale: 0,
  renderer: new SimpleRenderer({
    symbol: new SimpleLineSymbol({
      style: 'solid',
      color: [115, 223, 255, 255],
      cap: 'round',
      width: 2,
    }),
  }),
  labelingInfo: [
    {
      symbol: {
        type: 'text',
        color: 'white',
        haloColor: [115, 223, 255, 255],
        haloSize: 0.7,
        font: {
          family: 'Ubuntu Mono',
          size: 12,
          weight: 'normal',
        },
      },
      labelPlacement: 'center-along',
      labelExpressionInfo: {
        expression: '$feature.GNIS_Name',
      },
      minScale: 80000,
      maxScale: 0,
    },
  ],
});
const watershedAreas = new FeatureLayer({
  title: 'Watershed Areas',
  id: 'reference-watershed-areas',
  url: 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahWatershedsArea/FeatureServer/0',
  fields: ['HUC_10', 'HU_10_Name'],
  visible: false,
  labelsVisible: false,
  opacity: 0.7,
  minScale: 2000000,
  maxScale: 0,
  renderer: new SimpleRenderer({
    symbol: new SimpleFillSymbol({
      style: 'none',
      outline: {
        type: 'simple-line',
        style: 'solid',
        width: 3,
      },
    }),
  }),
  labelingInfo: [
    {
      symbol: {
        type: 'text',
        color: 'white',
        haloColor: 'black',
        haloSize: 2,
        font: {
          family: 'Ubuntu Mono',
          size: 12,
          weight: 'normal',
        },
      },
      labelExpressionInfo: {
        expression: '$feature.HU_10_Name + TextFormatting.NewLine + $feature.HUC_10',
      },
      minScale: 100001,
      maxScale: 0,
    },
    {
      symbol: {
        type: 'text',
        color: 'white',
        haloColor: 'black',
        haloSize: 3,
        font: {
          family: 'Ubuntu Mono',
          size: 12,
          weight: 'normal',
        },
      },
      labelExpressionInfo: {
        expression: '$feature.HUC_10',
      },
      minScale: 300000,
      maxScale: 100000,
    },
  ],
});
const fireThreats = new WebTileLayer({
  title: 'Fire Threat Index',
  id: 'reference-fire-threat-index',
  visible: false,
  urlTemplate: 'https://utwrapcache.timmons.com/mapproxy/wmts/firethreatindex/webmercator/{level}/{col}/{row}.png',
});
const precipitation = new FeatureLayer({
  title: 'Average Annual Precipitation',
  id: 'reference-precipitation',
  url: 'https://wrimaps.utah.gov/arcgis/rest/services/WRI/Reference/MapServer/15',
  fields: ['OBJECTID'],
  visible: false,
  opacity: 0.5,
  renderer: new ClassBreaksRenderer({
    field: 'Inches',
    classBreakInfos: [
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [255, 0, 0, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        minValue: 3,
        maxValue: 7,
        label: '3 - 7',
      }),
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [255, 165, 0, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        minValue: 8,
        maxValue: 12,
        label: '8 - 12',
      }),
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [255, 255, 0, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        minValue: 13,
        maxValue: 16,
        label: '13 - 16',
      }),
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [153, 255, 153, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        minValue: 17,
        maxValue: 22,
        label: '17 - 22',
      }),
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [0, 255, 0, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        minValue: 23,
        maxValue: 40,
        label: '23 - 40',
      }),
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [52, 114, 53, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        minValue: 41,
        maxValue: 75,
        label: '41 - 75',
      }),
    ],
  }),
  minScale: 2000000,
  maxScale: 0,
});
const rangeSites = new FeatureLayer({
  title: 'Range Trend Sites',
  id: 'reference-range-sites',
  url: 'https://wrimaps.utah.gov/arcgis/rest/services/WRI/Reference/MapServer/7',
  fields: ['STUDY_NAME', 'GlobalID'],
  visible: false,
  renderer: new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({
      style: 'circle',
      color: [255, 170, 0, 255],
      size: 7,
      angle: 0,
      xoffset: 0,
      yoffset: 0,
      outline: {
        color: [0, 0, 0, 255],
        width: 1,
      },
    }),
  }),
  popupTemplate: {
    title: '{STUDY_NAME}',
    content:
      'Visit the <a href="https://dwrapps.utah.gov/rangetrend/rtstart?SiteID={GlobalID}">Range Trend app</a> to see more information and photos for this site.',
  },
});
const regions = new FeatureLayer({
  title: 'UWRI Regions',
  id: 'reference-regions',
  url: 'https://wrimaps.utah.gov/arcgis/rest/services/WRI/Reference/MapServer/5',
  fields: ['DWR_REGION'],
  visible: false,
  labelsVisible: false,
  renderer: new SimpleRenderer({
    symbol: new SimpleFillSymbol({
      style: 'none',
      outline: new SimpleLineSymbol({
        style: 'solid',
        color: [43, 80, 78, 255],
        width: 2,
      }),
    }),
  }),
  labelingInfo: [
    {
      symbol: {
        type: 'text',
        color: 'white',
        haloColor: [43, 80, 78, 255],
        haloSize: 0.7,
        font: {
          family: 'Ubuntu Mono',
          size: 12,
          weight: 'normal',
        },
      },
      labelExpressionInfo: {
        expression: '$feature.DWR_REGION',
      },
      minScale: 0,
      maxScale: 0,
    },
  ],
});
const blmDistricts = new FeatureLayer({
  title: 'BLM Districts',
  id: 'reference-blm-districts',
  url: 'https://wrimaps.utah.gov/arcgis/rest/services/WRI/Reference/MapServer/0',
  fields: ['FO_NAME'],
  visible: false,
  labelsVisible: false,
  renderer: new SimpleRenderer({
    symbol: new SimpleFillSymbol({
      style: 'none',
      outline: new SimpleLineSymbol({
        style: 'solid',
        color: [254, 230, 121, 255],
        width: 2,
      }),
    }),
  }),
  labelingInfo: [
    {
      symbol: {
        type: 'text',
        color: 'black',
        haloColor: [254, 230, 121, 255],
        haloSize: 0.7,
        font: {
          family: 'Ubuntu Mono',
          size: 12,
          weight: 'normal',
        },
      },
      labelExpressionInfo: {
        expression: '$feature.FO_NAME',
      },
      minScale: 0,
      maxScale: 0,
    },
  ],
});
const forestService = new FeatureLayer({
  title: 'Forest Service',
  id: 'reference-forest-service',
  url: 'https://wrimaps.utah.gov/arcgis/rest/services/WRI/Reference/MapServer/1',
  fields: ['label_federal'],
  visible: false,
  labelsVisible: false,
  opacity: 0.7,
  renderer: new UniqueValueRenderer({
    field: 'label_federal',
    uniqueValueInfos: [
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 197, 243, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Ashley National Forest',
        label: 'Ashley National Forest',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 184, 208, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Ashley National Forest (Flaming Gorge National Recreation Area)',
        label: 'Ashley National Forest (Flaming Gorge National Recreation Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [197, 222, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Ashley National Forest (High Uintas Wilderness Area)',
        label: 'Ashley National Forest (High Uintas Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [189, 252, 237, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Cottonwood Canyon Wilderness Area',
        label: 'Cottonwood Canyon Wilderness Area',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 209, 182, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Desert Experimental Range',
        label: 'Desert Experimental Range',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [179, 230, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Dixie National Forest',
        label: 'Dixie National Forest',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [202, 252, 179, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Dixie National Forest ',
        label: 'Dixie National Forest ',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [214, 252, 207, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Dixie National Forest (Ashdown Gorge Wilderness Area)',
        label: 'Dixie National Forest (Ashdown Gorge Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 234, 212, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Dixie National Forest (Box-Death Hollow Wilderness Area)',
        label: 'Dixie National Forest (Box-Death Hollow Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [210, 252, 222, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Dixie National Forest (Pine Valley Mountains Wilderness Area)',
        label: 'Dixie National Forest (Pine Valley Mountains Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [209, 199, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Fishlake National Forest',
        label: 'Fishlake National Forest',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [179, 248, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Manti-La Sal National Forest',
        label: 'Manti-La Sal National Forest',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [214, 184, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Manti-La Sal National Forest ',
        label: 'Manti-La Sal National Forest ',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [230, 252, 184, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Manti-La Sal National Forest (Dark Canyon Wilderness Area)',
        label: 'Manti-La Sal National Forest (Dark Canyon Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 204, 222, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Sawtooth National Forest',
        label: 'Sawtooth National Forest',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 179, 244, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Uinta National Forest',
        label: 'Uinta National Forest',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [207, 246, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Uinta National Forest ',
        label: 'Uinta National Forest ',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 212, 210, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Uinta National Forest (Lone Peak Wilderness Area)',
        label: 'Uinta National Forest (Lone Peak Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [243, 210, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Uinta National Forest (Mount Nebo Wilderness Area)',
        label: 'Uinta National Forest (Mount Nebo Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 188, 179, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Uinta National Forest (Mount Timpanogos Wilderness Area)',
        label: 'Uinta National Forest (Mount Timpanogos Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [243, 252, 215, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Wasatch-Cache National Forest',
        label: 'Wasatch-Cache National Forest',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [184, 252, 184, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Wasatch-Cache National Forest ',
        label: 'Wasatch-Cache National Forest ',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [182, 185, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Wasatch-Cache National Forest (Deseret Peak Wilderness Area)',
        label: 'Wasatch-Cache National Forest (Deseret Peak Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 228, 182, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Wasatch-Cache National Forest (High Uintas Wilderness Area)',
        label: 'Wasatch-Cache National Forest (High Uintas Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 245, 179, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Wasatch-Cache National Forest (Lone Peak Wilderness Area)',
        label: 'Wasatch-Cache National Forest (Lone Peak Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [182, 252, 216, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Wasatch-Cache National Forest (Mount Naomi Wilderness Area)',
        label: 'Wasatch-Cache National Forest (Mount Naomi Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [184, 201, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Wasatch-Cache National Forest (Mount Olympus Wilderness Area)',
        label: 'Wasatch-Cache National Forest (Mount Olympus Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 242, 204, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Wasatch-Cache National Forest (Twin Peaks Wilderness Area)',
        label: 'Wasatch-Cache National Forest (Twin Peaks Wilderness Area)',
      },
      {
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [215, 252, 237, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Wasatch-Cache National Forest (Wellsville Mountain Wilderness Area)',
        label: 'Wasatch-Cache National Forest (Wellsville Mountain Wilderness Area)',
      },
    ],
  }),
  labelingInfo: [
    {
      symbol: {
        type: 'text',
        color: 'black',
        haloColor: [255, 255, 255, 255],
        haloSize: 3,
        font: {
          family: 'Ubuntu Mono',
          size: 12,
          weight: 'normal',
        },
      },
      labelExpressionInfo: {
        expression: '$feature.label_federal',
      },
      repeatLabel: false,
      minScale: 2000000,
      maxScale: 0,
    },
  ],
});
const sageGrouse = new FeatureLayer({
  title: 'Sage Grouse Areas',
  id: 'reference-sage-grouse',
  url: 'https://wrimaps.utah.gov/arcgis/rest/services/WRI/Reference/MapServer/4',
  fields: ['Area_name'],
  visible: false,
  labelsVisible: false,
  renderer: new UniqueValueRenderer({
    field: 'Area_name',
    defaultSymbol: new SimpleFillSymbol({
      style: 'solid',
      color: [205, 250, 243, 255],
      outline: new SimpleLineSymbol({
        style: 'solid',
        color: [110, 110, 110, 255],
        width: 0.4,
      }),
    }),
    defaultLabel: '<all other values>',
    uniqueValueInfos: [
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 182, 184, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Bald Hills',
        label: 'Bald Hills',
      }),
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [189, 252, 179, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Box Elder',
        label: 'Box Elder',
      }),
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 221, 204, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Carbon',
        label: 'Carbon',
      }),
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [225, 252, 182, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Hamlin Valley',
        label: 'Hamlin Valley',
      }),
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [240, 215, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Ibapah',
        label: 'Ibapah',
      }),
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [252, 187, 246, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Panguitch',
        label: 'Panguitch',
      }),
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [184, 182, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Parker Mountain-Emery',
        label: 'Parker Mountain-Emery',
      }),
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [247, 252, 207, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Rich-Morgan-Summit',
        label: 'Rich-Morgan-Summit',
      }),
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [184, 252, 227, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Sheeprock Mountains',
        label: 'Sheeprock Mountains',
      }),
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [182, 230, 252, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Strawberry',
        label: 'Strawberry',
      }),
      new UniqueValueInfo({
        symbol: new SimpleFillSymbol({
          style: 'solid',
          color: [215, 252, 244, 255],
          outline: new SimpleLineSymbol({
            style: 'solid',
            color: [110, 110, 110, 255],
            width: 0.4,
          }),
        }),
        value: 'Uintah',
        label: 'Uintah',
      }),
    ],
  }),
  opacity: 0.7,
});
const stewardship = new FeatureLayer({
  title: 'Shared Stewardship Priority',
  id: 'reference-stewardship',
  url: 'https://services.arcgis.com/ZzrwjTRez6FJiOq4/arcgis/rest/services/SharedStewardshipPriorityAreas_Public/FeatureServer/0',
  fields: ['HU_12_NAME'],
  visible: false,
  labelsVisible: false,
  renderer: new ClassBreaksRenderer({
    visualVariables: [
      new SizeVariable({
        target: 'outline',
        valueExpression: '$view.scale',
        stops: [
          { size: 1.5, value: 274762 },
          { size: 0.75, value: 858632 },
          { size: 0.375, value: 3434527 },
          { size: 0, value: 6869055 },
        ],
      }),
    ],
    field: 'Composite',
    classBreakInfos: [
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          color: [248, 227, 194, 255],
          outline: new SimpleLineSymbol({ color: [194, 194, 194, 64], width: 0.75, style: 'solid' }),
          style: 'solid',
        }),
        label: '0 – 81',
        minValue: 0,
        maxValue: 81,
      }),
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          color: [229, 153, 140, 255],
          outline: new SimpleLineSymbol({ color: [194, 194, 194, 64], width: 0.75, style: 'solid' }),
          style: 'solid',
        }),
        label: '> 81 – 95',
        minValue: 81,
        maxValue: 95,
      }),
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          color: [216, 104, 104, 255],
          outline: new SimpleLineSymbol({ color: [194, 194, 194, 64], width: 0.75, style: 'solid' }),
          style: 'solid',
        }),
        label: '> 95 – 111',
        minValue: 95,
        maxValue: 111,
      }),
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          color: [175, 70, 93, 255],
          outline: new SimpleLineSymbol({ color: [194, 194, 194, 64], width: 0.75, style: 'solid' }),
          style: 'solid',
        }),
        label: '> 111 – 128',
        minValue: 111,
        maxValue: 128,
      }),
      new ClassBreakInfo({
        symbol: new SimpleFillSymbol({
          color: [135, 35, 81, 255],
          outline: new SimpleLineSymbol({ color: [194, 194, 194, 64], width: 0.75, style: 'solid' }),
          style: 'solid',
        }),
        label: '> 128 – 217',
        minValue: 128,
        maxValue: 217,
      }),
    ],
  }),
});

export const MapContainer = ({ onClick }: { onClick?: __esri.ViewImmediateClickEventHandler }) => {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapComponent = useRef<EsriMap | null>(null);
  const mapView = useRef<MapView>();
  const clickHandler = useRef<IHandle>();
  const [selectorOptions, setSelectorOptions] = useState<SelectorOptions | null>(null);
  const { setMapView, addLayers } = useMap();
  const isReady = useMapReady(mapView.current);

  // setup the Map
  useEffect(() => {
    if (!mapNode.current || !setMapView) {
      return;
    }

    mapComponent.current = new EsriMap();

    mapView.current = new MapView({
      container: mapNode.current,
      map: mapComponent.current,
      extent: statewide,
      popup: {
        dockEnabled: true,
        visibleElements: {
          collapseButton: false,
        },
        dockOptions: {
          position: 'top-right',
          buttonEnabled: false,
          breakpoint: false,
        },
      },
      ui: {
        components: ['zoom'],
      },
    });

    setMapView(mapView.current);

    const selectorOptions: SelectorOptions = {
      view: mapView.current,
      quadWord: import.meta.env.VITE_DISCOVER,
      baseLayers: ['Hybrid', 'Lite', 'Terrain', 'Topo', 'Color IR'],
      position: 'top-right',
    };

    setSelectorOptions(selectorOptions);

    return () => {
      mapView.current?.destroy();
      mapComponent.current?.destroy();
    };
  }, [setMapView]);

  // add click event handlers
  useEffect(() => {
    if (onClick) {
      clickHandler.current = mapView.current!.on('immediate-click', onClick);
    }

    return () => {
      clickHandler.current?.remove();
    };
  }, [onClick, mapView]);

  // add the map layers
  useEffect(() => {
    if (isReady) {
      addLayers([
        landOwnership,
        plss,
        streams,
        watershedAreas,
        fireThreats,
        precipitation,
        rangeSites,
        regions,
        blmDistricts,
        forestService,
        sageGrouse,
        stewardship,
      ]);
    }
    setMapView(mapView.current!);
  }, [isReady, mapView, addLayers, setMapView]);

  return (
    <div ref={mapNode} className="size-full">
      {selectorOptions?.view && <LayerSelector {...selectorOptions}></LayerSelector>}
    </div>
  );
};
