import Graphic from '@arcgis/core/Graphic.js';
import { watch } from '@arcgis/core/core/reactiveUtils';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel.js';
import {
  Button,
  Checkbox,
  FileInput,
  Popover,
  Select,
  SelectItem,
  ToggleButton,
  Tooltip,
} from '@ugrc/utah-design-system';
import type { FeatureTable } from '@ugrc/wri-shared/types';
import {
  CheckIcon,
  ChevronDownIcon,
  DiamondIcon,
  MagnetIcon,
  PenLineIcon,
  RotateCcwIcon,
  ScissorsIcon,
  SquarePenIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DialogTrigger, Toolbar, TooltipTrigger } from 'react-aria-components';
import { getDraftPointSymbol, getDraftPolygonSymbol, getDraftPolylineSymbol } from '../config';
import { useShapefileUpload } from '../hooks/useShapefileUpload';
import {
  BUFFER_DRAFT_DISTANCES,
  bufferDraftGeometries,
  canBufferDraftGeometries,
  canCutDraftGeometries,
  cutDraftGeometries,
} from './addFeatureDraftGeometry';
import {
  ADJACENT_PROJECT_FEATURE_LAYER_IDS,
  getEffectiveAdjacentSnappingEnabled,
  getFeatureGeometrySnappingLayerIds,
  LAND_OWNERSHIP_REFERENCE_LAYER_ID,
} from './featureGeometrySnapping';
import {
  getAllowedUploadGeometryTypes,
  getPolyDraftModeForUploadedGeometry,
  type PolyDraftMode,
} from './featureGeometryUpload';
import { useMap } from './hooks';

const DRAW_TOOL: Record<FeatureTable, 'polygon' | 'polyline' | 'multipoint'> = {
  POLY: 'polygon',
  LINE: 'polyline',
  POINT: 'multipoint',
};

type DrawingState = 'idle' | 'drawing' | 'cutting' | 'editing' | 'complete';
type SerializedGeometry = object | object[];
type SnappingOptionKey = 'project' | 'adjacent' | 'landOwnership';
type SnappingState = Record<SnappingOptionKey, boolean>;

const getDrawTool = (table: FeatureTable, polyDraftMode: PolyDraftMode): 'polygon' | 'polyline' | 'multipoint' => {
  if (table === 'POLY' && polyDraftMode === 'buffered-line') {
    return 'polyline';
  }

  return DRAW_TOOL[table];
};

const getDefaultSymbol = (geometry: __esri.Geometry) => {
  switch (geometry.type) {
    case 'point':
    case 'multipoint':
      return getDraftPointSymbol();
    case 'polyline':
      return getDraftPolylineSymbol();
    case 'polygon':
      return getDraftPolygonSymbol();
    default:
      return null;
  }
};

const normalizeInitialGeometries = (
  initialGeometry?: __esri.Geometry | __esri.Geometry[] | null,
): __esri.Geometry[] => {
  if (!initialGeometry) {
    return [];
  }

  return Array.isArray(initialGeometry) ? initialGeometry : [initialGeometry];
};

const cloneGeometries = (geometries: __esri.Geometry[]): __esri.Geometry[] =>
  geometries.map((geometry) => geometry.clone() as __esri.Geometry);

type Props = {
  projectId: number;
  featureType: string;
  table: FeatureTable | undefined;
  adjacentProjectsVisible: boolean;
  onChange: (serializedGeometry: SerializedGeometry | null) => void;
  initialGeometry?: __esri.Geometry | __esri.Geometry[] | null;
  disabled?: boolean;
  autoStart?: boolean;
};

export default function FeatureGeometryEditor({
  projectId,
  featureType,
  table,
  adjacentProjectsVisible,
  onChange,
  initialGeometry,
  disabled = false,
  autoStart = true,
}: Props) {
  const { mapView } = useMap();
  const sketchVMRef = useRef<SketchViewModel | null>(null);
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);
  const activeToolRef = useRef<'draw' | 'cut'>('draw');
  const tableRef = useRef<FeatureTable | undefined>(undefined);
  const geometriesRef = useRef<__esri.Geometry[]>([]);
  const initialGeometriesRef = useRef<__esri.Geometry[]>([]);
  const polyDraftModeRef = useRef<PolyDraftMode>('polygon');
  const normalizedInitialGeometries = useMemo(() => normalizeInitialGeometries(initialGeometry), [initialGeometry]);

  const [geometries, setGeometries] = useState<__esri.Geometry[]>([]);
  const [drawingState, setDrawingState] = useState<DrawingState>('idle');
  const [selectedDraftCount, setSelectedDraftCount] = useState(0);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [polyDraftMode, setPolyDraftMode] = useState<PolyDraftMode>('polygon');
  const [bufferDistance, setBufferDistance] = useState('');
  const [snappingState, setSnappingState] = useState<SnappingState>({
    project: false,
    adjacent: false,
    landOwnership: false,
  });
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
  const [landOwnershipReferenceLayerVisible, setLandOwnershipReferenceLayerVisible] = useState(false);
  const allowedUploadGeometryTypes = useMemo(() => (table ? getAllowedUploadGeometryTypes(table) : []), [table]);
  const uploadDescription = useMemo(() => {
    switch (table) {
      case 'POLY':
        return 'Upload a .zip shapefile with polygons or lines to buffer. Include *.shp, *.dbf, and *.prj.';
      case 'LINE':
        return 'Upload a .zip shapefile with lines. Include *.shp, *.dbf, and *.prj.';
      case 'POINT':
        return 'Upload a .zip shapefile with points. Include *.shp, *.dbf, and *.prj.';
      default:
        return 'Upload a .zip shapefile. Include *.shp, *.dbf, and *.prj.';
    }
  }, [table]);

  const hasDraftLines = table === 'POLY' && geometries.some((geometry) => geometry.type === 'polyline');
  const isBufferEnabled = canBufferDraftGeometries(table, geometries);
  const isCutEnabled = canCutDraftGeometries(table, geometries);
  const canFinishSketch = drawingState === 'drawing' || drawingState === 'cutting';
  const hasInitialGeometry = normalizedInitialGeometries.length > 0;
  const setSnappingOption = useCallback((option: SnappingOptionKey, selected: boolean) => {
    setSnappingState((currentState) => {
      if (currentState[option] === selected) {
        return currentState;
      }

      return {
        ...currentState,
        [option]: selected,
      };
    });
  }, []);
  const effectiveAdjacentSnappingEnabled = getEffectiveAdjacentSnappingEnabled({
    adjacentSnappingEnabled: snappingState.adjacent,
    adjacentProjectsVisible,
  });
  const effectiveLandOwnershipSnappingEnabled = snappingState.landOwnership && landOwnershipReferenceLayerVisible;
  const snappingLayerIds = useMemo(
    () =>
      getFeatureGeometrySnappingLayerIds({
        projectId,
        projectSnappingEnabled: snappingState.project,
        adjacentSnappingEnabled: snappingState.adjacent,
        landOwnershipSnappingEnabled: effectiveLandOwnershipSnappingEnabled,
        adjacentProjectsVisible,
      }),
    [adjacentProjectsVisible, effectiveLandOwnershipSnappingEnabled, projectId, snappingState],
  );
  const adjacentSnappingPending = snappingState.adjacent && !adjacentProjectsVisible;
  const enabledSnappingLabels = [
    snappingState.project ? 'current project features' : null,
    effectiveAdjacentSnappingEnabled ? 'visible adjacent project features' : null,
    effectiveLandOwnershipSnappingEnabled ? 'land ownership boundaries' : null,
  ].filter((label): label is string => label !== null);
  const snappingControls = [
    {
      key: 'project',
      label: 'Project Features',
      isSelected: snappingState.project,
      isDisabled: disabled,
    },
    {
      key: 'adjacent',
      label: 'Adjacent Project Features',
      isSelected: snappingState.adjacent,
      isDisabled: disabled || (!adjacentProjectsVisible && !snappingState.adjacent),
    },
    {
      key: 'landOwnership',
      label: 'Land Ownership',
      isSelected: snappingState.landOwnership,
      isDisabled: disabled || !landOwnershipReferenceLayerVisible,
    },
  ] satisfies Array<{
    key: SnappingOptionKey;
    label: string;
    isSelected: boolean;
    isDisabled: boolean;
  }>;

  tableRef.current = table;

  const syncSnappingOptions = useCallback(() => {
    const sketchVM = sketchVMRef.current;

    if (!sketchVM) {
      return;
    }

    const featureLayers = snappingLayerIds.flatMap((layerId) => {
      const layer = mapView?.map?.findLayerById(layerId);

      if (!layer || layer.type !== 'feature') {
        return [];
      }

      if (ADJACENT_PROJECT_FEATURE_LAYER_IDS.includes(layer.id) && !layer.visible) {
        return [];
      }

      if (layer.id === LAND_OWNERSHIP_REFERENCE_LAYER_ID && !layer.visible) {
        return [];
      }

      return [layer as __esri.FeatureLayer];
    });

    sketchVM.snappingOptions = {
      enabled: featureLayers.length > 0,
      featureEnabled: featureLayers.length > 0,
      selfEnabled: true,
      gridEnabled: false,
      featureSources: featureLayers.map((layer) => ({ layer, enabled: true })),
    };
  }, [mapView, snappingLayerIds]);

  const syncSketchLayerGeometries = useCallback((nextGeometries: __esri.Geometry[]) => {
    const graphicsLayer = graphicsLayerRef.current;

    if (!graphicsLayer) {
      return;
    }

    graphicsLayer.removeAll();

    if (nextGeometries.length === 0) {
      return;
    }

    graphicsLayer.addMany(
      nextGeometries.map((geometry) => {
        const symbol = getDefaultSymbol(geometry) ?? undefined;

        return new Graphic({ geometry, symbol });
      }),
    );
  }, []);

  const setDraftGeometries = useCallback(
    (nextGeometries: __esri.Geometry[]) => {
      geometriesRef.current = nextGeometries;
      setGeometries(nextGeometries);
      syncSketchLayerGeometries(nextGeometries);
    },
    [syncSketchLayerGeometries],
  );

  const stopSketch = useCallback(() => {
    if (sketchVMRef.current) {
      sketchVMRef.current.updateOnGraphicClick = false;
    }

    setSelectedDraftCount(0);
    setGeometryError(null);
    sketchVMRef.current?.cancel();
    activeToolRef.current = 'draw';
  }, []);

  const syncGraphicsFromLayer = useCallback(() => {
    const layerGraphics = graphicsLayerRef.current?.graphics.toArray() ?? [];

    setDraftGeometries(layerGraphics.flatMap((graphic) => (graphic.geometry ? [graphic.geometry] : [])));
  }, [setDraftGeometries]);

  const handleUploadSuccess = useCallback(
    ({ geometry }: { geometry: __esri.Geometry; wkt3857: string }) => {
      if (!table) {
        return;
      }

      stopSketch();
      setGeometryError(null);
      setBufferDistance('');
      setSelectedDraftCount(0);

      if (table === 'POLY') {
        const nextPolyDraftMode = getPolyDraftModeForUploadedGeometry(table, geometry.type);

        polyDraftModeRef.current = nextPolyDraftMode;
        setPolyDraftMode(nextPolyDraftMode);
      }

      setDraftGeometries([geometry]);
      setDrawingState('complete');

      if (mapView) {
        const targetExtent = geometry.extent;
        const target =
          geometry.type === 'point' || (targetExtent != null && targetExtent.width === 0 && targetExtent.height === 0)
            ? { target: geometry, zoom: 14 }
            : (targetExtent?.clone().expand(1.2) ?? geometry);

        Promise.resolve(mapView.goTo(target)).catch(() => {});
      }
    },
    [mapView, setDraftGeometries, stopSketch, table],
  );

  const handleUploadClear = useCallback(() => {
    stopSketch();
    setDraftGeometries([]);
    setBufferDistance('');
    setSelectedDraftCount(0);
    setGeometryError(null);
    setPolyDraftMode('polygon');
    polyDraftModeRef.current = 'polygon';
    setDrawingState('idle');
  }, [setDraftGeometries, stopSketch]);

  const {
    clear: clearUploadedFiles,
    error: shapefileError,
    files: uploadedFiles,
    handleFileChange,
    isLoading: isUploadingShapefile,
  } = useShapefileUpload({
    allowedGeometryTypes: allowedUploadGeometryTypes,
    onSuccess: handleUploadSuccess,
    onClear: handleUploadClear,
  });

  useEffect(() => {
    if (isUploadingShapefile || !!shapefileError || (uploadedFiles?.length ?? 0) > 0) {
      setIsUploadPanelOpen(true);
    }
  }, [isUploadingShapefile, shapefileError, uploadedFiles]);

  useEffect(() => {
    const landOwnershipLayer = mapView?.map?.findLayerById(LAND_OWNERSHIP_REFERENCE_LAYER_ID);

    if (!landOwnershipLayer || landOwnershipLayer.type !== 'feature') {
      setLandOwnershipReferenceLayerVisible(false);

      return;
    }

    const featureLayer = landOwnershipLayer as __esri.FeatureLayer;
    setLandOwnershipReferenceLayerVisible(featureLayer.visible);

    const handle = watch(
      () => featureLayer.visible,
      (visible) => {
        setLandOwnershipReferenceLayerVisible(visible);
      },
    );

    return () => {
      handle.remove();
    };
  }, [mapView]);

  useEffect(() => {
    polyDraftModeRef.current = polyDraftMode;
  }, [polyDraftMode]);

  useEffect(() => {
    if (!featureType || !table || geometries.length === 0 || (table === 'POLY' && hasDraftLines)) {
      onChange(null);

      return;
    }

    const serializedGeometry =
      geometries.length === 1
        ? (geometries[0]!.toJSON() as object)
        : geometries.map((geometry) => geometry.toJSON() as object);

    onChange(serializedGeometry);
  }, [featureType, geometries, hasDraftLines, onChange, table]);

  useEffect(() => {
    if (!mapView || !featureType || !table) {
      clearUploadedFiles();
      onChange(null);

      return;
    }

    sketchVMRef.current?.cancel();
    sketchVMRef.current?.destroy();
    sketchVMRef.current = null;

    if (graphicsLayerRef.current) {
      mapView.map?.remove(graphicsLayerRef.current);
      graphicsLayerRef.current = null;
    }

    setGeometries([]);
    geometriesRef.current = [];
    setDrawingState('idle');
    setSelectedDraftCount(0);
    setGeometryError(null);
    setBufferDistance('');
    setPolyDraftMode('polygon');
    polyDraftModeRef.current = 'polygon';
    activeToolRef.current = 'draw';
    initialGeometriesRef.current = cloneGeometries(normalizedInitialGeometries);
    clearUploadedFiles();
    onChange(null);

    const graphicsLayer = new GraphicsLayer({ id: 'feature-geometry-editor-sketch' });
    graphicsLayerRef.current = graphicsLayer;
    mapView.map?.add(graphicsLayer);

    const isMultipart = table === 'POLY' || table === 'LINE';
    const sketchVM = new SketchViewModel({
      view: mapView,
      layer: graphicsLayer,
      creationMode: isMultipart ? 'continuous' : 'single',
      updateOnGraphicClick: false,
      defaultUpdateOptions: {
        tool: 'reshape',
        toggleToolOnClick: false,
        multipleSelectionEnabled: false,
      },
      pointSymbol: getDraftPointSymbol(),
      polylineSymbol: getDraftPolylineSymbol(),
      polygonSymbol: getDraftPolygonSymbol(),
    });
    sketchVMRef.current = sketchVM;
    syncSnappingOptions();

    sketchVM.on('create', (event) => {
      if (event.state === 'complete' && event.graphic.geometry) {
        if (activeToolRef.current === 'cut' && event.graphic.geometry.type === 'polyline') {
          const currentTable = tableRef.current;

          if (!currentTable || currentTable === 'POINT') {
            syncSketchLayerGeometries(geometriesRef.current);
            setDrawingState(geometriesRef.current.length > 0 ? 'complete' : 'idle');

            return;
          }

          try {
            const result = cutDraftGeometries({
              geometries: geometriesRef.current,
              cutGeometry: event.graphic.geometry as __esri.Polyline,
              table: currentTable,
            });

            syncSketchLayerGeometries(result.geometries);

            if (!result.changed) {
              setGeometryError(result.error);
              setDrawingState(result.geometries.length > 0 ? 'complete' : 'idle');

              return;
            }

            setGeometryError(null);
            setDraftGeometries(result.geometries);
            setDrawingState('complete');
          } catch (error) {
            setGeometryError(error instanceof Error ? error.message : 'Failed to cut the drafted geometry.');
            syncSketchLayerGeometries(geometriesRef.current);
            setDrawingState(geometriesRef.current.length > 0 ? 'complete' : 'idle');
          } finally {
            activeToolRef.current = 'draw';
          }

          return;
        }

        const geometry = event.graphic.geometry as __esri.Geometry;
        const nextGeometries = [...geometriesRef.current, geometry];

        geometriesRef.current = nextGeometries;
        setGeometries(nextGeometries);
        setGeometryError(null);

        if (!isMultipart) {
          setDrawingState('complete');
        }
      } else if (event.state === 'cancel') {
        setDrawingState(geometriesRef.current.length > 0 ? 'complete' : 'idle');
      }
    });

    sketchVM.on('update', (event) => {
      if (event.state === 'start') {
        setGeometryError(null);
        setSelectedDraftCount(event.graphics.length);
        setDrawingState('editing');

        return;
      }

      if (event.state === 'active') {
        setSelectedDraftCount(event.graphics.length);

        return;
      }

      if (event.state === 'complete') {
        syncGraphicsFromLayer();
        setSelectedDraftCount(0);
        setDrawingState(
          sketchVM.updateOnGraphicClick ? 'editing' : geometriesRef.current.length > 0 ? 'complete' : 'idle',
        );
      }
    });

    sketchVM.on('delete', () => {
      syncGraphicsFromLayer();
      setSelectedDraftCount(0);
      setGeometryError(null);
      setDrawingState(
        sketchVM.updateOnGraphicClick && graphicsLayer.graphics.length > 0
          ? 'editing'
          : graphicsLayer.graphics.length > 0
            ? 'complete'
            : 'idle',
      );
    });

    const initialGeometries = initialGeometriesRef.current;

    if (initialGeometries.length > 0) {
      setDraftGeometries(cloneGeometries(initialGeometries));
      setDrawingState('complete');

      return () => {
        sketchVM.cancel();
        sketchVM.destroy();
        mapView.map?.remove(graphicsLayer);
      };
    }

    if (!disabled && autoStart) {
      sketchVM.create(getDrawTool(table, polyDraftModeRef.current));
      setDrawingState('drawing');
    }

    return () => {
      sketchVM.cancel();
      sketchVM.destroy();
      mapView.map?.remove(graphicsLayer);
    };
  }, [
    autoStart,
    disabled,
    featureType,
    mapView,
    normalizedInitialGeometries,
    onChange,
    setDraftGeometries,
    syncGraphicsFromLayer,
    syncSnappingOptions,
    syncSketchLayerGeometries,
    table,
    clearUploadedFiles,
  ]);

  useEffect(() => {
    syncSnappingOptions();
  }, [syncSnappingOptions]);

  useEffect(() => {
    if (!mapView?.map) {
      return;
    }

    const handle = mapView.map.layers.on('change', () => {
      syncSnappingOptions();
    });

    return () => {
      handle.remove();
    };
  }, [mapView, syncSnappingOptions]);

  useEffect(() => {
    if (!disabled) {
      return;
    }

    stopSketch();
    setDrawingState(geometriesRef.current.length > 0 ? 'complete' : 'idle');
  }, [disabled, stopSketch]);

  const startDrawing = (nextPolyDraftMode: PolyDraftMode = polyDraftMode) => {
    if (disabled || !sketchVMRef.current || !table) {
      return;
    }

    const nextDrawTool = getDrawTool(table, nextPolyDraftMode);

    setGeometryError(null);
    setBufferDistance('');
    setSelectedDraftCount(0);
    activeToolRef.current = 'draw';

    if (table === 'POLY') {
      polyDraftModeRef.current = nextPolyDraftMode;
      setPolyDraftMode(nextPolyDraftMode);
    }

    sketchVMRef.current.cancel();
    sketchVMRef.current.updateOnGraphicClick = false;
    sketchVMRef.current.creationMode = table === 'POINT' ? 'single' : 'continuous';
    sketchVMRef.current.create(nextDrawTool);
    setDrawingState('drawing');
  };

  const startCutting = () => {
    if (disabled || !sketchVMRef.current || !table || !isCutEnabled) {
      return;
    }

    sketchVMRef.current.cancel();
    activeToolRef.current = 'cut';
    setSelectedDraftCount(0);
    sketchVMRef.current.updateOnGraphicClick = false;
    sketchVMRef.current.creationMode = 'single';
    sketchVMRef.current.create('polyline');
    setGeometryError(null);
    setDrawingState('cutting');
  };

  const startEditing = () => {
    if (disabled || !sketchVMRef.current) {
      return;
    }

    const layerGraphics = graphicsLayerRef.current?.graphics.toArray() ?? [];

    if (layerGraphics.length === 0) {
      return;
    }

    sketchVMRef.current.cancel();
    sketchVMRef.current.updateOnGraphicClick = true;
    activeToolRef.current = 'draw';
    setGeometryError(null);
    setSelectedDraftCount(0);
    setDrawingState('editing');
  };

  const applyBufferDistance = async (nextDistance: string) => {
    setBufferDistance(nextDistance);

    if (disabled || !table || table !== 'POLY') {
      return;
    }

    const parsedDistance = Number.parseInt(nextDistance, 10);

    if (Number.isNaN(parsedDistance)) {
      setGeometryError(null);

      return;
    }

    sketchVMRef.current?.cancel();
    activeToolRef.current = 'draw';
    setSelectedDraftCount(0);

    try {
      const result = await bufferDraftGeometries({
        geometries: geometriesRef.current,
        distance: parsedDistance,
        table,
      });

      if (!result.changed) {
        setGeometryError(result.error);

        return;
      }

      setDraftGeometries(result.geometries);
      setBufferDistance('');
      setGeometryError(null);
      setDrawingState('complete');
    } catch (error) {
      setGeometryError(error instanceof Error ? error.message : 'Failed to buffer the drafted lines.');
    }
  };

  const deleteSelectedGeometry = () => {
    if (disabled || !sketchVMRef.current || selectedDraftCount === 0) {
      return;
    }

    sketchVMRef.current.delete();
  };

  const finishActiveSketch = () => {
    if (disabled || !sketchVMRef.current || !canFinishSketch) {
      return;
    }

    sketchVMRef.current.creationMode = 'single';
    sketchVMRef.current.complete();
  };

  const resetDraftGeometries = () => {
    if (disabled || !hasInitialGeometry) {
      return;
    }

    stopSketch();
    clearUploadedFiles();
    setDraftGeometries(cloneGeometries(initialGeometriesRef.current));
    setBufferDistance('');
    setPolyDraftMode('polygon');
    polyDraftModeRef.current = 'polygon';
    setDrawingState(initialGeometriesRef.current.length > 0 ? 'complete' : 'idle');
  };

  if (!featureType || !table) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="secondary"
          onPress={() => setIsUploadPanelOpen((isOpen) => !isOpen)}
          aria-controls="feature-geometry-upload-panel"
          aria-expanded={isUploadPanelOpen}
          isDisabled={disabled}
          size="extraSmall"
        >
          <span>Shapefile</span>
          <ChevronDownIcon className={`size-4 transition-transform ${isUploadPanelOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>
      {isUploadPanelOpen && (
        <div
          id="feature-geometry-upload-panel"
          className="flex flex-col gap-1 rounded border border-zinc-200 p-2 dark:border-zinc-700"
        >
          <FileInput
            acceptedFileTypes={['application/zip']}
            description={uploadDescription}
            errorMessage={shapefileError || undefined}
            isDisabled={disabled || isUploadingShapefile}
            isInvalid={!!shapefileError}
            label="Upload a shapefile"
            onChange={handleFileChange}
            value={uploadedFiles}
            showFileSize={false}
          />
          {isUploadingShapefile && !shapefileError && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Processing shapefile…</p>
          )}
        </div>
      )}
      <Toolbar aria-label="Drawing tools" className="flex flex-wrap items-center gap-0.5">
        {table === 'POLY' && (
          <TooltipTrigger>
            <div>
              <ToggleButton
                isSelected={drawingState === 'drawing' && polyDraftMode === 'polygon'}
                onChange={(selected) => {
                  if (selected) {
                    startDrawing('polygon');
                  } else {
                    stopSketch();
                  }
                }}
                aria-label="Draw polygon"
                isDisabled={disabled}
              >
                <DiamondIcon className="size-4" />
              </ToggleButton>
            </div>
            <Tooltip>Draw polygon</Tooltip>
          </TooltipTrigger>
        )}
        <TooltipTrigger>
          <div>
            <ToggleButton
              isSelected={drawingState === 'drawing' && (table !== 'POLY' || polyDraftMode === 'buffered-line')}
              onChange={(selected) => {
                if (selected) {
                  startDrawing(table === 'POLY' ? 'buffered-line' : polyDraftMode);
                } else {
                  stopSketch();
                }
              }}
              aria-label={table === 'POLY' ? 'Draw line' : 'Draw'}
              isDisabled={disabled}
            >
              <PenLineIcon className="size-4" />
            </ToggleButton>
          </div>
          <Tooltip>{table === 'POLY' ? 'Draw line' : 'Draw'}</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <div>
            <ToggleButton
              isSelected={drawingState === 'editing'}
              onChange={(selected) => {
                if (selected) {
                  startEditing();
                } else {
                  stopSketch();
                }
              }}
              aria-label="Edit vertices"
              isDisabled={disabled || geometries.length === 0}
            >
              <SquarePenIcon className="size-4" />
            </ToggleButton>
          </div>
          <Tooltip>Edit vertices</Tooltip>
        </TooltipTrigger>
        {(table === 'POLY' || table === 'LINE') && (
          <TooltipTrigger>
            <div>
              <ToggleButton
                isSelected={drawingState === 'cutting'}
                onChange={(selected) => {
                  if (selected) {
                    startCutting();
                  } else {
                    stopSketch();
                  }
                }}
                aria-label="Cut"
                isDisabled={disabled || !isCutEnabled}
              >
                <ScissorsIcon className="size-4" />
              </ToggleButton>
            </div>
            <Tooltip>Cut</Tooltip>
          </TooltipTrigger>
        )}
        <DialogTrigger>
          <div>
            <TooltipTrigger>
              <Button variant="icon" aria-label="Snapping options" isDisabled={disabled} className="min-h-0 p-0.5">
                <MagnetIcon className="size-4" />
                <ChevronDownIcon className="size-4" />
              </Button>
              <Tooltip>Snapping options</Tooltip>
            </TooltipTrigger>
          </div>
          <Popover placement="bottom left" className="w-72 px-4 py-3">
            <div className="flex flex-col gap-3">
              {snappingControls.map((option) => (
                <Checkbox
                  key={option.key}
                  isSelected={option.isSelected}
                  onChange={(selected) => setSnappingOption(option.key, selected)}
                  isDisabled={option.isDisabled}
                >
                  <span className="text-sm">{option.label}</span>
                </Checkbox>
              ))}
              {!landOwnershipReferenceLayerVisible && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Turn on Land Ownership in the Reference tab to enable land ownership snapping.
                </p>
              )}
              {!adjacentProjectsVisible && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Turn on Adjacent Projects in the Reference tab to enable adjacent project snapping.
                </p>
              )}
            </div>
          </Popover>
        </DialogTrigger>
        <div className="ml-auto flex items-center gap-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-700">
          <TooltipTrigger>
            <div>
              <Button
                variant="primary"
                aria-label="Finish drawing"
                isDisabled={disabled || !canFinishSketch}
                onPress={finishActiveSketch}
                className="min-h-0 p-0.5"
              >
                <CheckIcon className="size-4" />
              </Button>
            </div>
            <Tooltip>Finish drawing</Tooltip>
          </TooltipTrigger>
          {hasInitialGeometry && (
            <TooltipTrigger>
              <div>
                <Button
                  variant="secondary"
                  aria-label="Reset geometry"
                  isDisabled={disabled}
                  onPress={resetDraftGeometries}
                  className="min-h-0 p-0.5"
                >
                  <RotateCcwIcon className="size-4" />
                </Button>
              </div>
              <Tooltip>Reset geometry</Tooltip>
            </TooltipTrigger>
          )}
          <TooltipTrigger>
            <div>
              <Button
                variant="destructive"
                aria-label="Delete selected feature"
                isDisabled={disabled || drawingState !== 'editing' || selectedDraftCount === 0}
                onPress={deleteSelectedGeometry}
                className="min-h-0 p-0.5"
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
            <Tooltip>Delete selected feature</Tooltip>
          </TooltipTrigger>
        </div>
      </Toolbar>
      {table === 'POLY' && polyDraftMode === 'buffered-line' && isBufferEnabled && (
        <Select
          label="Buffer distance"
          selectedKey={bufferDistance || null}
          onSelectionChange={(key) => void applyBufferDistance((key as string) ?? '')}
          isDisabled={disabled}
          placeholder="Select a distance"
        >
          {BUFFER_DRAFT_DISTANCES.map((distance) => (
            <SelectItem key={distance} id={distance.toString()}>
              {distance} meters
            </SelectItem>
          ))}
        </Select>
      )}
      {adjacentSnappingPending && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Turn on Adjacent Projects in the Reference tab to snap to adjacent project features.
        </p>
      )}
      {!adjacentSnappingPending && enabledSnappingLabels.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {`Snapping to ${enabledSnappingLabels.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`}
        </p>
      )}
      {drawingState === 'idle' && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {table === 'POLY' ? 'Choose Polygon or Line to begin.' : 'Click Draw to begin.'}
        </p>
      )}
      {drawingState === 'idle' && table === 'POLY' && polyDraftMode === 'buffered-line' && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Draw one or more lines, then choose a buffer distance to convert them into polygon geometry.
        </p>
      )}
      {drawingState === 'drawing' && geometries.length === 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {table === 'POLY' && polyDraftMode === 'buffered-line'
            ? `Click on the map to draw a line. Press Enter or double-click to finish the current line, or use Finish${hasInitialGeometry ? ' or Reset' : ''} when you are done.`
            : `Click on the map to draw. Press Enter or double-click to finish the current part, or use Finish${hasInitialGeometry ? ' or Reset' : ''} when you are done.`}
        </p>
      )}
      {drawingState === 'drawing' && geometries.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {table === 'POLY' && polyDraftMode === 'buffered-line'
            ? `${geometries.length} line part${geometries.length > 1 ? 's' : ''} drawn. Choose a buffer distance or keep drawing lines, or use Finish${hasInitialGeometry ? ' or Reset' : ''} when you are done.`
            : `${geometries.length} part${geometries.length > 1 ? 's' : ''} drawn. Drawing next part. Press Enter or double-click to finish the current part, or use Finish${hasInitialGeometry ? ' or Reset' : ''} when you are done.`}
        </p>
      )}
      {drawingState === 'cutting' && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Draw a cut line across the drafted geometry. Press Enter or double-click to finish the cut.
          {hasInitialGeometry ? ' Use Reset to restore the original geometry.' : ''}
        </p>
      )}
      {drawingState === 'editing' && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Select a geometry, then drag vertices to adjust or use the delete button to remove it.
          {hasInitialGeometry ? ' Use Reset to restore the original geometry.' : ''}
        </p>
      )}
      {drawingState === 'complete' && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          {table === 'POLY' && polyDraftMode === 'buffered-line' && !hasDraftLines
            ? `${geometries.length} polygon part${geometries.length > 1 ? 's' : ''} ready. Click Polygon or Line to add more geometry, or Edit vertices to adjust the buffered geometry.`
            : `${geometries.length} part${geometries.length > 1 ? 's' : ''} drawn. ${table === 'POLY' ? 'Click Polygon or Line to add another part.' : 'Click Draw to add another part.'}`}
        </p>
      )}
      {!isCutEnabled && (table === 'POLY' || table === 'LINE') && drawingState !== 'drawing' && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {table === 'POLY' && hasDraftLines
            ? 'Buffer drafted lines before using Cut.'
            : 'Finish at least one part before using Cut.'}
        </p>
      )}
      {table === 'POLY' && hasDraftLines && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Buffer drafted lines before saving this polygon feature.
        </p>
      )}
      {geometryError && <p className="text-xs text-red-600 dark:text-red-400">{geometryError}</p>}
    </div>
  );
}
