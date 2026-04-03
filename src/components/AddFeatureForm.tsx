import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel.js';
import { Button, Checkbox, Select, SelectItem, TextArea, ToggleButton, Tooltip } from '@ugrc/utah-design-system';
import { PenLineIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Toolbar, TooltipTrigger } from 'react-aria-components';
import type {
  CreateFeatureData,
  EditingDomainsResponse,
  FeatureTable,
  FormPointLineAction,
  FormPolyAction,
  FormPolyTreatment,
  PolyFeatureAttributes,
} from '../types';
import { titleCase } from './';
import { shouldShowHerbicideField } from './addFeatureFormHelpers';
import { isNoActionCategory, isRetreatmentEligibleCategory, isSubtypeActionCategory } from './addFeatureRules';
import { useMap } from './hooks';

const DRAW_TOOL: Record<FeatureTable, 'polygon' | 'polyline' | 'multipoint'> = {
  POLY: 'polygon',
  LINE: 'polyline',
  POINT: 'multipoint',
};

const NO_HERBICIDE_KEY = '__none__';

const createEmptyPolyTreatment = (): FormPolyTreatment => ({ treatment: '', herbicide: null });

const createEmptyPolyAction = (): FormPolyAction => ({ action: '', treatments: [createEmptyPolyTreatment()] });

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

  const [category, setCategory] = useState<string>('');
  const [geometry, setGeometry] = useState<__esri.Geometry | null>(null);
  const [drawingState, setDrawingState] = useState<'idle' | 'drawing' | 'complete'>('idle');
  const [retreatment, setRetreatment] = useState(false);
  const [polyActions, setPolyActions] = useState<FormPolyAction[]>([createEmptyPolyAction()]);
  const [pointLineAction, setPointLineAction] = useState<FormPointLineAction>({
    type: '',
    action: '',
    description: '',
  });

  const table = category && domains ? domains.featureTypes[category] : undefined;
  const categoryAttrs = category && domains ? domains.featureAttributes[category] : undefined;
  const showsRetreatment = isRetreatmentEligibleCategory(category);

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
    setGeometry(null);
    setDrawingState('idle');

    const resolvedTable = domains?.featureTypes?.[category];
    if (!resolvedTable) return;

    const graphicsLayer = new GraphicsLayer({ id: 'add-feature-sketch' });
    graphicsLayerRef.current = graphicsLayer;
    mapView.map?.add(graphicsLayer);

    const sketchVM = new SketchViewModel({ view: mapView, layer: graphicsLayer });
    sketchVMRef.current = sketchVM;

    sketchVM.on('create', (event) => {
      if (event.state === 'complete' && event.graphic.geometry) {
        setGeometry(event.graphic.geometry as __esri.Geometry);
        setDrawingState('complete');
      } else if (event.state === 'cancel') {
        setDrawingState('idle');
      }
    });

    sketchVM.create(DRAW_TOOL[resolvedTable]);
    setDrawingState('drawing');
  }, [mapView, category, domains?.featureTypes]);

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
              treatments: a.treatments.map((t, ti) => (ti === treatmentIdx ? { ...t, treatment, herbicide: null } : t)),
            }
          : a,
      ),
    );

  const updateHerbicide = (actionIdx: number, treatmentIdx: number, herbicide: string | null) =>
    setPolyActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx
          ? {
              ...a,
              treatments: a.treatments.map((t, ti) => (ti === treatmentIdx ? { ...t, herbicide } : t)),
            }
          : a,
      ),
    );

  // Re-activate the draw tool (used by the toolbar Draw button)
  const startDrawing = () => {
    if (!sketchVMRef.current || !table) return;
    graphicsLayerRef.current?.removeAll();
    setGeometry(null);
    sketchVMRef.current.create(DRAW_TOOL[table]);
    setDrawingState('drawing');
  };

  // Decide what actions to send
  const buildActions = (): CreateFeatureData['actions'] => {
    if (!table || isNoActionCategory(category)) return null;
    if (table === 'POLY') return polyActions;
    return [pointLineAction];
  };

  const isValid = (): boolean => {
    if (!category || !geometry) return false;
    if (isNoActionCategory(category)) return true;
    if (table === 'POLY') {
      return polyActions.every((a) => a.action.trim() && a.treatments.every((t) => t.treatment.trim()));
    }
    if (isSubtypeActionCategory(category)) {
      return !!(pointLineAction.type.trim() && pointLineAction.action.trim());
    }
    return !!pointLineAction.description.trim();
  };

  const handleSubmit = () => {
    if (!geometry) return;
    onSave({
      projectId,
      featureType: category,
      geometry: geometry.toJSON() as object,
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
                      sketchVMRef.current?.cancel();
                    }
                  }}
                  aria-label="Draw"
                >
                  <PenLineIcon className="size-4" />
                </ToggleButton>
              </div>
              <Tooltip>Draw</Tooltip>
            </TooltipTrigger>
          </Toolbar>
          {drawingState === 'idle' && <p className="text-xs text-zinc-500 dark:text-zinc-400">Click Draw to begin.</p>}
          {drawingState === 'drawing' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Click on the map to draw. Press Enter or double-click to finish. Press Escape to cancel.
            </p>
          )}
          {drawingState === 'complete' && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">Feature drawn. Click Draw to redraw.</p>
          )}
        </div>
      )}

      {/* POLY actions (not for affected area) */}
      {table === 'POLY' && !isNoActionCategory(category) && (
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
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Select
                              label={`Treatment ${treatmentIdx + 1}`}
                              selectedKey={treatment.treatment || null}
                              onSelectionChange={(key) => updateTreatmentField(actionIdx, treatmentIdx, key as string)}
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
                            <Select
                              label="Herbicide"
                              selectedKey={treatment.herbicide?.trim() ? treatment.herbicide : NO_HERBICIDE_KEY}
                              onSelectionChange={(key) =>
                                updateHerbicide(
                                  actionIdx,
                                  treatmentIdx,
                                  key === NO_HERBICIDE_KEY ? null : ((key as string) ?? null),
                                )
                              }
                            >
                              <SelectItem id={NO_HERBICIDE_KEY} key={NO_HERBICIDE_KEY}>
                                No herbicide
                              </SelectItem>
                              {domains.herbicides.map((herbicide) => (
                                <SelectItem key={herbicide} id={herbicide}>
                                  {herbicide}
                                </SelectItem>
                              ))}
                            </Select>
                          )}
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
