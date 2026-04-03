import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel.js';
import {
  Button,
  Radio,
  RadioGroup,
  Select,
  SelectItem,
  Tag,
  TagGroup,
  TextArea,
  ToggleButton,
  Tooltip,
} from '@ugrc/utah-design-system';
import { PenLineIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Toolbar, TooltipTrigger } from 'react-aria-components';
import type {
  CreateFeatureData,
  EditingDomainsResponse,
  FeatureTable,
  FormPointLineAction,
  FormPolyAction,
  PolyFeatureAttributes,
} from '../types';
import { titleCase } from './';
import { useMap } from './hooks';

const DRAW_TOOL: Record<FeatureTable, 'polygon' | 'polyline' | 'multipoint'> = {
  POLY: 'polygon',
  LINE: 'polyline',
  POINT: 'multipoint',
};

const NO_ACTION_CATEGORIES = new Set(['affected area', 'other point feature']);
const SUBTYPE_ACTION_CATEGORIES = new Set(['guzzler', 'fish passage structure', 'fence', 'pipeline', 'dam']);

const isNoAction = (cat: string) => NO_ACTION_CATEGORIES.has(cat.toLowerCase());
const isSubtypeAction = (cat: string) => SUBTYPE_ACTION_CATEGORIES.has(cat.toLowerCase());

const EMPTY_POLY_ACTION: FormPolyAction = { action: '', treatments: [{ treatment: '', herbicides: [] }] };

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
  const [retreatment, setRetreatment] = useState<'Y' | 'N'>('N');
  const [polyActions, setPolyActions] = useState<FormPolyAction[]>([{ ...EMPTY_POLY_ACTION }]);
  const [pointLineAction, setPointLineAction] = useState<FormPointLineAction>({
    type: '',
    action: '',
    description: '',
  });

  const table = category && domains ? domains.featureTypes[category] : undefined;
  const categoryAttrs = category && domains ? domains.featureAttributes[category] : undefined;

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
  const addPolyAction = () => setPolyActions((prev) => [...prev, { ...EMPTY_POLY_ACTION }]);

  const removePolyAction = (idx: number) => setPolyActions((prev) => prev.filter((_, i) => i !== idx));

  const updatePolyActionField = (idx: number, action: string) =>
    setPolyActions((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, action, treatments: [{ treatment: '', herbicides: [] }] } : a)),
    );

  const addTreatment = (actionIdx: number) =>
    setPolyActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx ? { ...a, treatments: [...a.treatments, { treatment: '', herbicides: [] }] } : a,
      ),
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

  const updateHerbicides = (actionIdx: number, treatmentIdx: number, selected: Iterable<string>) =>
    setPolyActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx
          ? {
              ...a,
              treatments: a.treatments.map((t, ti) => (ti === treatmentIdx ? { ...t, herbicides: [...selected] } : t)),
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
    if (!table || isNoAction(category)) return null;
    if (table === 'POLY') return polyActions;
    return [pointLineAction];
  };

  const isValid = (): boolean => {
    if (!category || !geometry) return false;
    if (isNoAction(category)) return true;
    if (table === 'POLY') {
      return polyActions.every((a) => a.action.trim() && a.treatments.every((t) => t.treatment.trim()));
    }
    if (isSubtypeAction(category)) {
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
        label="Feature category"
        selectedKey={category}
        onSelectionChange={(key) => {
          setCategory(key as string);
          setPolyActions([{ ...EMPTY_POLY_ACTION }]);
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

      {/* POLY retreatment */}
      {table === 'POLY' && (
        <RadioGroup label="Retreatment" value={retreatment} onChange={(v) => setRetreatment(v as 'Y' | 'N')}>
          <Radio value="N">No</Radio>
          <Radio value="Y">Yes</Radio>
        </RadioGroup>
      )}

      {/* POLY actions (not for affected area) */}
      {table === 'POLY' && !isNoAction(category) && (
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

                        {treatment.treatment && domains && domains.herbicides.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-medium">Herbicides (optional)</p>
                            <TagGroup
                              selectionMode="multiple"
                              selectedKeys={new Set(treatment.herbicides)}
                              onSelectionChange={(selected) =>
                                updateHerbicides(actionIdx, treatmentIdx, selected as Iterable<string>)
                              }
                            >
                              {(domains.herbicides as string[]).map((h) => (
                                <Tag key={h} id={h} textValue={h}>
                                  {h}
                                </Tag>
                              ))}
                            </TagGroup>
                          </div>
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
      {table && table !== 'POLY' && !isNoAction(category) && isSubtypeAction(category) && (
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
      {table === 'POINT' && !isNoAction(category) && !isSubtypeAction(category) && (
        <TextArea
          label="Description"
          value={pointLineAction.description}
          onChange={(v) => setPointLineAction((prev) => ({ ...prev, description: v }))}
        />
      )}

      {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" onPress={onCancel} isDisabled={isSaving}>
          Cancel
        </Button>
        <Button variant="primary" onPress={handleSubmit} isDisabled={!isValid() || isSaving}>
          {isSaving ? 'Saving…' : 'Save Feature'}
        </Button>
      </div>
    </div>
  );
}
