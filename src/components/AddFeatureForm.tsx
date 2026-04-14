import { Button, Checkbox, Select, SelectItem, TextArea } from '@ugrc/utah-design-system';
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
  FormPointLineAction,
  FormPolyAction,
  FormPolyTreatment,
  PolyFeatureAttributes,
} from '@ugrc/wri-shared/types';
import { useEffect, useState } from 'react';
import { titleCase } from './';
import FeatureGeometryEditor from './FeatureGeometryEditor';

const HERBICIDE_PLACEHOLDER_KEY = '__unselected__';

const createEmptyPolyTreatment = (): FormPolyTreatment => ({ treatment: '', herbicides: [] });

const createEmptyPolyAction = (): FormPolyAction => ({ action: '', treatments: [createEmptyPolyTreatment()] });

type Props = {
  projectId: number;
  adjacentProjectsVisible: boolean;
  domains: EditingDomainsResponse | undefined;
  isSaving: boolean;
  saveError: string | null;
  onCancel: () => void;
  onSave: (data: CreateFeatureData) => void;
};

export default function AddFeatureForm({
  projectId,
  adjacentProjectsVisible,
  domains,
  isSaving,
  saveError,
  onCancel,
  onSave,
}: Props) {
  const [category, setCategory] = useState<string>('');
  const [serializedGeometry, setSerializedGeometry] = useState<object | object[] | null>(null);
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

  useEffect(() => {
    if (!showsRetreatment) {
      setRetreatment(false);
    }
  }, [showsRetreatment]);

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
    if (!category || !serializedGeometry) return false;
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
    if (!serializedGeometry) return;

    onSave({
      projectId,
      featureType: category,
      geometry: serializedGeometry,
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
          setSerializedGeometry(null);
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
        <FeatureGeometryEditor
          projectId={projectId}
          featureType={category}
          table={table}
          adjacentProjectsVisible={adjacentProjectsVisible}
          disabled={isSaving}
          onChange={setSerializedGeometry}
        />
      )}

      {table === 'POLY' && isAffectedArea && (
        <div className="flex flex-col gap-3">
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
