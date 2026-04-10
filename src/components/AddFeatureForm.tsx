import Graphic from '@arcgis/core/Graphic.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import { fromJSON as symbolFromJSON } from '@arcgis/core/symbols/support/jsonUtils.js';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel.js';
import { Button, Checkbox, Select, SelectItem, TextArea, ToggleButton, Tooltip } from '@ugrc/utah-design-system';
import {
  hasRequiredHerbicideSelections,
  isAffectedAreaCategory,
  isNoActionCategory,
  isRetreatmentEligibleCategory,
  isSubtypeActionCategory,
  normalizeHerbicides,
  shouldShowHerbicideField,
} from '@ugrc/wri-shared/feature-rules';
import type {
  CreateFeatureData,
  EditingDomainsResponse,
  FeatureTable,
  FormPointLineAction,
  FormPolyAction,
  FormPolyTreatment,
  PolyFeatureAttributes,
} from '@ugrc/wri-shared/types';
import { PenLineIcon, ScissorsIcon, SquarePenIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Toolbar, TooltipTrigger } from 'react-aria-components';
import { titleCase } from './';
import { canCutDraftGeometries, cutDraftGeometries } from './addFeatureDraftGeometry';
import { useMap } from './hooks';

const DRAW_TOOL: Record<FeatureTable, 'polygon' | 'polyline' | 'multipoint'> = {
  POLY: 'polygon',
  LINE: 'polyline',
  POINT: 'multipoint',
};

const HERBICIDE_PLACEHOLDER_KEY = '__unselected__';

const createEmptyPolyTreatment = (): FormPolyTreatment => ({ treatment: '', herbicides: [] });

const createEmptyPolyAction = (): FormPolyAction => ({ action: '', treatments: [createEmptyPolyTreatment()] });

const cloneSymbol = (symbol: __esri.SymbolProperties | null | undefined): __esri.SymbolProperties | undefined => {
  return symbol ? { ...symbol } : undefined;
};

type Props = {
  projectId: number;
  domains: EditingDomainsResponse | undefined;
  isSaving: boolean;
  saveError: string | null;
  onCancel: () => void;
  onSave: (data: CreateFeatureData) => void;
};

export default function AddFeatureForm({ projectId, domains, isSaving, saveError, onCancel, onSave }: Props) {
  const { mapView } = useMap();
  const sketchVMRef = useRef<SketchViewModel | null>(null);
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);
  const activeToolRef = useRef<'draw' | 'cut'>('draw');
  const tableRef = useRef<FeatureTable | undefined>(undefined);
  const geometrySymbolsRef = useRef<Array<__esri.SymbolProperties | null>>([]);

  const [category, setCategory] = useState<string>('');
  const [geometries, setGeometries] = useState<__esri.Geometry[]>([]);
  const geometriesRef = useRef<__esri.Geometry[]>([]);
  const [drawingState, setDrawingState] = useState<'idle' | 'drawing' | 'cutting' | 'editing' | 'complete'>('idle');
  const [selectedDraftCount, setSelectedDraftCount] = useState(0);
  const [cutError, setCutError] = useState<string | null>(null);
  const [retreatment, setRetreatment] = useState(false);
  const [affectedAreaAction, setAffectedAreaAction] = useState('');
  const [polyActions, setPolyActions] = useState<FormPolyAction[]>([createEmptyPolyAction()]);
  const [pointLineAction, setPointLineAction] = useState<FormPointLineAction>({
    type: '',
    action: '',
    description: '',
  });

  const table = category && domains ? domains.featureTypes[category] : undefined;
  const categoryAttrs = category && domains ? domains.featureAttributes[category] : undefined;
  const isAffectedArea = isAffectedAreaCategory(category);
  const showsRetreatment = isRetreatmentEligibleCategory(category);
  const isCutEnabled = canCutDraftGeometries(table, geometries);

  tableRef.current = table;

  const syncSketchLayerGeometries = useCallback(
    (
      nextGeometries: __esri.Geometry[],
      nextSymbols: Array<__esri.SymbolProperties | null> = geometrySymbolsRef.current,
    ) => {
      const graphicsLayer = graphicsLayerRef.current;

      if (!graphicsLayer) {
        return;
      }

      graphicsLayer.removeAll();

      if (nextGeometries.length === 0) {
        return;
      }

      graphicsLayer.addMany(
        nextGeometries.map((geometry, index) => {
          const graphic = new Graphic({ geometry });
          const symbol = cloneSymbol(nextSymbols[index]);

          if (symbol) {
            graphic.symbol = symbolFromJSON(symbol);
          }

          return graphic;
        }),
      );
    },
    [],
  );

  const setDraftGeometries = useCallback(
    (
      nextGeometries: __esri.Geometry[],
      nextSymbols: Array<__esri.SymbolProperties | null> = geometrySymbolsRef.current,
    ) => {
      geometriesRef.current = nextGeometries;
      geometrySymbolsRef.current = nextSymbols;
      setGeometries(nextGeometries);
      syncSketchLayerGeometries(nextGeometries, nextSymbols);
    },
    [syncSketchLayerGeometries],
  );

  const stopSketch = () => {
    if (sketchVMRef.current) {
      sketchVMRef.current.updateOnGraphicClick = false;
    }

    setSelectedDraftCount(0);
    sketchVMRef.current?.cancel();
    activeToolRef.current = 'draw';
  };

  const syncGraphicsFromLayer = useCallback(() => {
    const layerGraphics = graphicsLayerRef.current?.graphics.toArray() ?? [];

    setDraftGeometries(
      layerGraphics.flatMap((graphic) => (graphic.geometry ? [graphic.geometry] : [])),
      layerGraphics.map((graphic) => (graphic.symbol ? graphic.symbol.toJSON() : null)),
    );
  }, [setDraftGeometries]);

  useEffect(() => {
    if (!showsRetreatment) {
      setRetreatment(false);
    }
  }, [showsRetreatment]);

  // Start/restart drawing when category changes
  useEffect(() => {
    if (!mapView || !category) return;

    // Clean up previous sketch
    sketchVMRef.current?.cancel();
    sketchVMRef.current?.destroy();
    sketchVMRef.current = null;
    if (graphicsLayerRef.current) {
      mapView.map?.remove(graphicsLayerRef.current);
      graphicsLayerRef.current = null;
    }
    setGeometries([]);
    geometriesRef.current = [];
    geometrySymbolsRef.current = [];
    setDrawingState('idle');
    setSelectedDraftCount(0);
    setCutError(null);
    activeToolRef.current = 'draw';

    const resolvedTable = domains?.featureTypes?.[category];
    if (!resolvedTable) return;

    const graphicsLayer = new GraphicsLayer({ id: 'add-feature-sketch' });
    graphicsLayerRef.current = graphicsLayer;
    mapView.map?.add(graphicsLayer);

    const isMultipart = resolvedTable === 'POLY' || resolvedTable === 'LINE';
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
    });
    sketchVMRef.current = sketchVM;

    sketchVM.on('create', (event) => {
      if (event.state === 'complete' && event.graphic.geometry) {
        if (activeToolRef.current === 'cut' && event.graphic.geometry.type === 'polyline') {
          const currentTable = tableRef.current;
          const currentSymbols = geometrySymbolsRef.current.map((symbol) => symbol ?? null);

          if (!currentTable || currentTable === 'POINT') {
            syncSketchLayerGeometries(geometriesRef.current, currentSymbols);
            setDrawingState(geometriesRef.current.length > 0 ? 'complete' : 'idle');

            return;
          }

          try {
            const result = cutDraftGeometries({
              geometries: geometriesRef.current,
              cutGeometry: event.graphic.geometry as __esri.Polyline,
              table: currentTable,
            });

            syncSketchLayerGeometries(result.geometries, currentSymbols);

            if (!result.changed) {
              setCutError(result.error);
              setDrawingState(result.geometries.length > 0 ? 'complete' : 'idle');

              return;
            }

            setCutError(null);
            setDraftGeometries(result.geometries, currentSymbols);
            setDrawingState('complete');
          } catch (error) {
            setCutError(error instanceof Error ? error.message : 'Failed to cut the drafted geometry.');
            syncSketchLayerGeometries(geometriesRef.current, currentSymbols);
            setDrawingState(geometriesRef.current.length > 0 ? 'complete' : 'idle');
          } finally {
            activeToolRef.current = 'draw';
          }

          return;
        }

        const geom = event.graphic.geometry as __esri.Geometry;
        const nextGeometries = [...geometriesRef.current, geom];
        const nextSymbols = [
          ...geometrySymbolsRef.current,
          event.graphic.symbol ? event.graphic.symbol.toJSON() : null,
        ];
        geometriesRef.current = nextGeometries;
        geometrySymbolsRef.current = nextSymbols;
        setGeometries(nextGeometries);
        setCutError(null);
        if (!isMultipart) {
          setDrawingState('complete');
        }
      } else if (event.state === 'cancel') {
        if (geometriesRef.current.length > 0) {
          setDrawingState('complete');
        } else {
          setDrawingState('idle');
        }
      }
    });

    sketchVM.on('update', (event) => {
      if (event.state === 'start') {
        setCutError(null);
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
      setDrawingState(
        sketchVM.updateOnGraphicClick && graphicsLayer.graphics.length > 0
          ? 'editing'
          : graphicsLayer.graphics.length > 0
            ? 'complete'
            : 'idle',
      );
    });

    sketchVM.create(DRAW_TOOL[resolvedTable]);
    setDrawingState('drawing');
  }, [mapView, category, domains?.featureTypes, setDraftGeometries, syncGraphicsFromLayer, syncSketchLayerGeometries]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      sketchVMRef.current?.cancel();
      sketchVMRef.current?.destroy();
      if (graphicsLayerRef.current && mapView) {
        mapView.map?.remove(graphicsLayerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poly action helpers
  const addPolyAction = () => setPolyActions((prev) => [...prev, createEmptyPolyAction()]);

  const removePolyAction = (idx: number) => setPolyActions((prev) => prev.filter((_, i) => i !== idx));

  const updatePolyActionField = (idx: number, action: string) =>
    setPolyActions((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, action, treatments: [createEmptyPolyTreatment()] } : a)),
    );

  const addTreatment = (actionIdx: number) =>
    setPolyActions((prev) =>
      prev.map((a, i) => (i === actionIdx ? { ...a, treatments: [...a.treatments, createEmptyPolyTreatment()] } : a)),
    );

  const removeTreatment = (actionIdx: number, treatmentIdx: number) =>
    setPolyActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx ? { ...a, treatments: a.treatments.filter((_, ti) => ti !== treatmentIdx) } : a,
      ),
    );

  const updateTreatmentField = (actionIdx: number, treatmentIdx: number, treatment: string) =>
    setPolyActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx
          ? {
              ...a,
              treatments: a.treatments.map((t, ti) => (ti === treatmentIdx ? { ...t, treatment, herbicides: [] } : t)),
            }
          : a,
      ),
    );

  const addHerbicide = (actionIdx: number, treatmentIdx: number) =>
    setPolyActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx
          ? {
              ...a,
              treatments: a.treatments.map((t, ti) =>
                ti === treatmentIdx
                  ? { ...t, herbicides: t.herbicides.length > 0 ? [...t.herbicides, ''] : ['', ''] }
                  : t,
              ),
            }
          : a,
      ),
    );

  const removeHerbicide = (actionIdx: number, treatmentIdx: number, herbicideIdx: number) =>
    setPolyActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx
          ? {
              ...a,
              treatments: a.treatments.map((t, ti) =>
                ti === treatmentIdx ? { ...t, herbicides: t.herbicides.filter((_, hi) => hi !== herbicideIdx) } : t,
              ),
            }
          : a,
      ),
    );

  const updateHerbicide = (actionIdx: number, treatmentIdx: number, herbicideIdx: number, herbicide: string | null) =>
    setPolyActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx
          ? {
              ...a,
              treatments: a.treatments.map((t, ti) => {
                if (ti !== treatmentIdx) {
                  return t;
                }

                const nextHerbicide = herbicide?.trim() ?? '';

                if (t.herbicides.length === 0) {
                  return { ...t, herbicides: nextHerbicide ? [nextHerbicide] : [] };
                }

                return {
                  ...t,
                  herbicides: t.herbicides.map((value, hi) => (hi === herbicideIdx ? nextHerbicide : value)),
                };
              }),
            }
          : a,
      ),
    );

  // Re-activate the draw tool to add another part
  const startDrawing = () => {
    if (!sketchVMRef.current || !table) return;
    setCutError(null);
    setSelectedDraftCount(0);
    activeToolRef.current = 'draw';
    sketchVMRef.current.updateOnGraphicClick = false;
    sketchVMRef.current.creationMode = table === 'POINT' ? 'single' : 'continuous';
    sketchVMRef.current.create(DRAW_TOOL[table]);
    setDrawingState('drawing');
  };

  const startCutting = () => {
    if (!sketchVMRef.current || !table || !isCutEnabled) {
      return;
    }

    sketchVMRef.current.cancel();
    activeToolRef.current = 'cut';
    setSelectedDraftCount(0);
    sketchVMRef.current.updateOnGraphicClick = false;
    sketchVMRef.current.creationMode = 'single';
    sketchVMRef.current.create('polyline');
    setCutError(null);
    setDrawingState('cutting');
  };

  const startEditing = () => {
    if (!sketchVMRef.current) {
      return;
    }

    const layerGraphics = graphicsLayerRef.current?.graphics.toArray() ?? [];

    if (layerGraphics.length === 0) {
      return;
    }

    sketchVMRef.current.cancel();
    sketchVMRef.current.updateOnGraphicClick = true;
    activeToolRef.current = 'draw';
    setCutError(null);
    setSelectedDraftCount(0);
    setDrawingState('editing');
  };

  const deleteSelectedGeometry = () => {
    if (!sketchVMRef.current || selectedDraftCount === 0) {
      return;
    }

    sketchVMRef.current.delete();
  };

  // Decide what actions to send
  const buildActions = (): CreateFeatureData['actions'] => {
    if (!table || isNoActionCategory(category)) return null;
    if (table === 'POLY') {
      if (isAffectedArea) {
        return [{ action: affectedAreaAction.trim(), treatments: [] }];
      }

      return polyActions.map((action) => ({
        ...action,
        treatments: action.treatments.map((treatment) => ({
          ...treatment,
          herbicides: normalizeHerbicides(treatment.herbicides),
        })),
      }));
    }
    return [pointLineAction];
  };

  const isValid = (): boolean => {
    if (!category || geometries.length === 0) return false;
    if (isNoActionCategory(category)) return true;
    if (table === 'POLY') {
      if (isAffectedArea) {
        return affectedAreaAction.trim().length > 0;
      }

      return polyActions.every(
        (a) =>
          a.action.trim() &&
          a.treatments.every(
            (t) =>
              t.treatment.trim() &&
              hasRequiredHerbicideSelections(
                a.action,
                t.treatment,
                t.herbicides.length > 0 ? t.herbicides : [''],
                domains?.herbicides.length ?? 0,
              ),
          ),
      );
    }
    if (isSubtypeActionCategory(category)) {
      return !!(pointLineAction.type.trim() && pointLineAction.action.trim());
    }
    return !!pointLineAction.description.trim();
  };

  const handleSubmit = () => {
    if (geometries.length === 0) return;
    const geometry =
      geometries.length === 1 ? (geometries[0]!.toJSON() as object) : geometries.map((g) => g.toJSON() as object);
    onSave({
      projectId,
      featureType: category,
      geometry,
      retreatment,
      actions: buildActions(),
    });
  };

  const categories = Object.keys(domains?.featureTypes ?? {});

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">Add Feature</h3>

      <Select
        label="Category"
        selectedKey={category}
        onSelectionChange={(key) => {
          setCategory(key as string);
          setAffectedAreaAction('');
          setRetreatment(false);
          setPolyActions([createEmptyPolyAction()]);
          setPointLineAction({ type: '', action: '', description: '' });
        }}
      >
        {categories.map((cat) => (
          <SelectItem key={cat} id={cat}>
            {titleCase(cat)}
          </SelectItem>
        ))}
      </Select>

      {category && table && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Drawing tools</p>
          <Toolbar aria-label="Drawing tools" className="flex gap-0.5">
            <TooltipTrigger>
              <div>
                <ToggleButton
                  isSelected={drawingState === 'drawing'}
                  onChange={(selected) => {
                    if (selected) {
                      startDrawing();
                    } else {
                      stopSketch();
                    }
                  }}
                  aria-label="Draw"
                >
                  <PenLineIcon className="size-4" />
                </ToggleButton>
              </div>
              <Tooltip>Draw</Tooltip>
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
                  isDisabled={geometries.length === 0}
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
                    isDisabled={!isCutEnabled}
                  >
                    <ScissorsIcon className="size-4" />
                  </ToggleButton>
                </div>
                <Tooltip>Cut</Tooltip>
              </TooltipTrigger>
            )}
            <TooltipTrigger>
              <div>
                <Button
                  variant="icon"
                  aria-label="Delete selected feature"
                  isDisabled={drawingState !== 'editing' || selectedDraftCount === 0}
                  onPress={deleteSelectedGeometry}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
              <Tooltip>Delete selected feature</Tooltip>
            </TooltipTrigger>
          </Toolbar>
          {drawingState === 'idle' && <p className="text-xs text-zinc-500 dark:text-zinc-400">Click Draw to begin.</p>}
          {drawingState === 'drawing' && geometries.length === 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Click on the map to draw. Press Enter or double-click to finish the current part. Press Escape to cancel.
            </p>
          )}
          {drawingState === 'drawing' && geometries.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {geometries.length} part{geometries.length > 1 ? 's' : ''} drawn. Drawing next part. Press Enter or
              double-click to finish the current part. Press Escape to stop.
            </p>
          )}
          {drawingState === 'cutting' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Draw a cut line across the drafted geometry. Press Enter or double-click to finish the cut. Press Escape
              to cancel.
            </p>
          )}
          {drawingState === 'editing' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select a geometry, then drag vertices to adjust or use delete button to remove it. Press Escape to cancel
              the current edit.
            </p>
          )}
          {drawingState === 'complete' && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              {geometries.length} part{geometries.length > 1 ? 's' : ''} drawn. Click Draw to add another part.
            </p>
          )}
          {!isCutEnabled && (table === 'POLY' || table === 'LINE') && drawingState !== 'drawing' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Finish at least one part before using Cut.</p>
          )}
          {cutError && <p className="text-xs text-red-600 dark:text-red-400">{cutError}</p>}
        </div>
      )}

      {table === 'POLY' && isAffectedArea && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Action</p>
          <Select
            label="Action"
            selectedKey={affectedAreaAction || null}
            onSelectionChange={(key) => setAffectedAreaAction(key as string)}
          >
            {(domains?.affectedAreaActions ?? []).map((opt) => (
              <SelectItem key={opt} id={opt}>
                {opt}
              </SelectItem>
            ))}
          </Select>
        </div>
      )}

      {/* POLY actions (excluding affected area) */}
      {table === 'POLY' && !isNoActionCategory(category) && !isAffectedArea && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Actions</p>
          {polyActions.map((polyAction, actionIdx) => {
            const polyAttrs = categoryAttrs as PolyFeatureAttributes | undefined;
            const actionOptions = polyAttrs ? Object.keys(polyAttrs) : [];
            const treatmentOptions = polyAttrs && polyAction.action ? (polyAttrs[polyAction.action] ?? []) : [];

            return (
              <div
                key={actionIdx}
                className="flex flex-col gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-700"
              >
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Select
                      label={`Action ${actionIdx + 1}`}
                      selectedKey={polyAction.action || null}
                      onSelectionChange={(key) => updatePolyActionField(actionIdx, key as string)}
                    >
                      {actionOptions.map((opt) => (
                        <SelectItem key={opt} id={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  {polyActions.length > 1 && (
                    <Button variant="destructive" size="extraSmall" onPress={() => removePolyAction(actionIdx)}>
                      Remove
                    </Button>
                  )}
                </div>

                {polyAction.action && (
                  <div className="flex flex-col gap-2 pl-2">
                    <p className="text-xs font-medium">Treatments</p>
                    {polyAction.treatments.map((treatment, treatmentIdx) => (
                      <div
                        key={treatmentIdx}
                        className="flex flex-col gap-1 rounded border border-zinc-100 p-1.5 dark:border-zinc-800"
                      >
                        {(() => {
                          const herbicideSelections = treatment.herbicides.length > 0 ? treatment.herbicides : [''];

                          return (
                            <>
                              <div className="flex items-end gap-2">
                                <div className="flex-1">
                                  <Select
                                    label={`Treatment ${treatmentIdx + 1}`}
                                    selectedKey={treatment.treatment || null}
                                    onSelectionChange={(key) =>
                                      updateTreatmentField(actionIdx, treatmentIdx, key as string)
                                    }
                                  >
                                    {treatmentOptions.map((opt) => (
                                      <SelectItem key={opt} id={opt}>
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </Select>
                                </div>
                                {polyAction.treatments.length > 1 && (
                                  <Button
                                    variant="destructive"
                                    size="extraSmall"
                                    onPress={() => removeTreatment(actionIdx, treatmentIdx)}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>

                              {domains &&
                                shouldShowHerbicideField(
                                  polyAction.action,
                                  treatment.treatment,
                                  domains.herbicides.length,
                                ) && (
                                  <div className="flex flex-col gap-2 pt-1">
                                    {herbicideSelections.map((herbicide, herbicideIdx) => (
                                      <div
                                        key={`${treatmentIdx}-herbicide-${herbicideIdx}`}
                                        className="flex items-end gap-2"
                                      >
                                        <div className="flex-1">
                                          <Select
                                            label={`Herbicide ${herbicideIdx + 1}`}
                                            selectedKey={herbicide.trim() ? herbicide : HERBICIDE_PLACEHOLDER_KEY}
                                            onSelectionChange={(key) =>
                                              updateHerbicide(
                                                actionIdx,
                                                treatmentIdx,
                                                herbicideIdx,
                                                key === HERBICIDE_PLACEHOLDER_KEY ? null : ((key as string) ?? null),
                                              )
                                            }
                                          >
                                            <SelectItem id={HERBICIDE_PLACEHOLDER_KEY} key={HERBICIDE_PLACEHOLDER_KEY}>
                                              please select a herbicide
                                            </SelectItem>
                                            {domains.herbicides.map((herbicideOption) => (
                                              <SelectItem key={herbicideOption} id={herbicideOption}>
                                                {herbicideOption}
                                              </SelectItem>
                                            ))}
                                          </Select>
                                        </div>
                                        {herbicideSelections.length > 1 && (
                                          <Button
                                            variant="destructive"
                                            size="extraSmall"
                                            onPress={() => removeHerbicide(actionIdx, treatmentIdx, herbicideIdx)}
                                          >
                                            Remove
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                    <Button
                                      variant="secondary"
                                      size="extraSmall"
                                      onPress={() => addHerbicide(actionIdx, treatmentIdx)}
                                    >
                                      + Herbicide
                                    </Button>
                                  </div>
                                )}
                            </>
                          );
                        })()}
                      </div>
                    ))}

                    {treatmentOptions.length > 0 && (
                      <Button variant="secondary" size="extraSmall" onPress={() => addTreatment(actionIdx)}>
                        + Treatment
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <Button variant="secondary" size="extraSmall" onPress={addPolyAction}>
            + Action
          </Button>
        </div>
      )}

      {/* POINT / LINE with type + action */}
      {table && table !== 'POLY' && !isNoActionCategory(category) && isSubtypeActionCategory(category) && (
        <div className="flex flex-col gap-2">
          <Select
            label="Type"
            selectedKey={pointLineAction.type || null}
            onSelectionChange={(key) => setPointLineAction((prev) => ({ ...prev, type: key as string }))}
          >
            {((categoryAttrs as string[]) ?? []).map((opt) => (
              <SelectItem key={opt} id={opt}>
                {opt}
              </SelectItem>
            ))}
          </Select>
          <Select
            label="Action"
            selectedKey={pointLineAction.action || null}
            onSelectionChange={(key) => setPointLineAction((prev) => ({ ...prev, action: key as string }))}
          >
            {(domains?.pointLineActions ?? []).map((opt) => (
              <SelectItem key={opt} id={opt}>
                {opt}
              </SelectItem>
            ))}
          </Select>
        </div>
      )}

      {/* POINT with description only */}
      {table === 'POINT' && !isNoActionCategory(category) && !isSubtypeActionCategory(category) && (
        <TextArea
          label="Description"
          value={pointLineAction.description}
          onChange={(v) => setPointLineAction((prev) => ({ ...prev, description: v }))}
        />
      )}

      {/* POLY retreatment */}
      {table === 'POLY' && showsRetreatment && (
        <Checkbox isSelected={retreatment} onChange={setRetreatment}>
          Retreatment
        </Checkbox>
      )}

      {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" onPress={onCancel} isDisabled={isSaving}>
          Cancel
        </Button>
        <Button variant="primary" onPress={handleSubmit} isDisabled={!isValid() || isSaving} isPending={isSaving}>
          {isSaving ? <span className="ml-2">Saving…</span> : <span>Save Feature</span>}
        </Button>
      </div>
    </div>
  );
}
