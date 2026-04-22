import Collection from '@arcgis/core/core/Collection';
import { fromJSON } from '@arcgis/core/geometry/support/jsonUtils';
import Graphic from '@arcgis/core/Graphic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Switch, Tab, TabList, TabPanel, Tabs } from '@ugrc/utah-design-system';
import type {
  CreateFeatureData,
  CreateFeatureRequest,
  CreateFeatureResponse,
  DeleteFeatureRequest,
  DeleteFeatureResponse,
  Feature,
  FeatureIntersections,
  FeatureKind,
  FeatureRequest,
  FormPointLineAction,
  FormPolyAction,
  PolygonFeature,
  ProjectRequest,
  ProjectResponse,
  UpdateFeatureData,
  UpdateFeatureRequest,
  UpdateFeatureResponse,
} from '@ugrc/wri-shared/types';
import { DiamondIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Group } from 'react-aria-components';
import { List } from 'react-content-loader';
import { ErrorBoundary } from 'react-error-boundary';
import { useEditingDomains } from '../hooks/useEditingDomains';
import { useAuthedCallable, useCallableData } from '../hooks/useTypedCallable';
import { POLY_OPACITY } from '../mapLayers';
import {
  AdjacentProjects,
  DownloadProjectData,
  OpacityManager,
  ProjectStatusTag,
  ReferenceData,
  ReferenceLabelSwitch,
  TagGroupLoader,
  titleCase,
  type ReferenceLayer,
} from './';
import { useFeatureSelection } from './contexts';
import { ErrorFallback } from './ErrorFallBack';
import FeatureForm, { type FeatureFormInitialValues } from './FeatureForm';
import { getProjectFeatureLayerId, resolveSelectedFeature, type FeatureSelectionIdentity } from './featureSelection';
import { useMap } from './hooks';
import { useHighlight } from './hooks/useHighlight';
import ProjectFeaturesList from './ProjectFeaturesList';
import { UpdateProjectStatistics } from './UpdateProjectStatistics';

const buildPointLineActions = (feature: Feature): FormPointLineAction[] => [
  {
    type: feature.subtype ?? '',
    action: feature.action ?? '',
    description: feature.description ?? '',
  },
];

const buildPolygonActions = (polyGroup: PolygonFeature[]): FormPolyAction[] => {
  const actionsByName = new Map<string, Map<string, Set<string>>>();

  for (const polygon of polyGroup) {
    const actionName = polygon.action?.trim() ?? '';

    if (!actionName) {
      continue;
    }

    if (!actionsByName.has(actionName)) {
      actionsByName.set(actionName, new Map());
    }

    const treatments = actionsByName.get(actionName)!;
    const treatmentName = polygon.subtype?.trim() ?? '';

    if (!treatmentName) {
      continue;
    }

    if (!treatments.has(treatmentName)) {
      treatments.set(treatmentName, new Set());
    }

    const herbicides = treatments.get(treatmentName)!;

    for (const herbicide of polygon.herbicides ?? []) {
      const normalized = herbicide.trim();

      if (normalized) {
        herbicides.add(normalized);
      }
    }
  }

  return Array.from(actionsByName.entries()).map(([action, treatments]) => ({
    action,
    treatments:
      treatments.size === 0
        ? []
        : Array.from(treatments.entries()).map(([treatment, herbicides]) => ({
            treatment,
            herbicides: Array.from(herbicides),
          })),
  }));
};

const buildFeatureFormInitialValues = (
  project: ProjectResponse,
  selection: FeatureSelectionIdentity,
  initialGeometry: __esri.Geometry,
): FeatureFormInitialValues | null => {
  if (selection.kind === 'poly') {
    const polyGroup = Object.values(project.polygons ?? {}).find((group) => group[0]?.id === selection.id);
    const feature = polyGroup?.[0];

    if (!feature || !polyGroup) {
      return null;
    }

    return {
      featureType: feature.type,
      retreatment: feature.retreatment === true,
      actions: buildPolygonActions(polyGroup),
      initialGeometry,
    };
  }

  if (selection.kind === 'line') {
    const feature = project.lines.find((candidate) => candidate.id === selection.id);

    if (!feature) {
      return null;
    }

    return {
      featureType: feature.type,
      retreatment: false,
      actions: buildPointLineActions(feature),
      initialGeometry,
    };
  }

  const feature = project.points.find((candidate) => candidate.id === selection.id);

  if (!feature) {
    return null;
  }

  return {
    featureType: feature.type,
    retreatment: false,
    actions: buildPointLineActions(feature),
    initialGeometry,
  };
};

const buildDisplayGeometry = (geometry: CreateFeatureData['geometry']): __esri.Geometry => {
  const parseGeometry = (value: object): __esri.Geometry => {
    const parsedGeometry = fromJSON(value);

    if (!parsedGeometry) {
      throw new Error('Failed to parse display geometry.');
    }

    return parsedGeometry as __esri.Geometry;
  };

  if (!Array.isArray(geometry)) {
    return parseGeometry(geometry);
  }

  if (geometry.length === 0) {
    throw new Error('Cannot build display geometry from an empty geometry array.');
  }

  const first = geometry[0] as Record<string, unknown>;
  const spatialReference = first.spatialReference as Record<string, unknown> | undefined;

  if ('rings' in first) {
    const rings = geometry.flatMap((item) => {
      const json = item as Record<string, unknown>;

      if (!('rings' in json) || !Array.isArray(json.rings)) {
        throw new Error('Multipart polygon payload must contain only polygon geometries.');
      }

      return json.rings as number[][][];
    });

    return parseGeometry({
      type: 'polygon',
      rings,
      ...(spatialReference ? { spatialReference } : {}),
    });
  }

  if ('paths' in first) {
    const paths = geometry.flatMap((item) => {
      const json = item as Record<string, unknown>;

      if (!('paths' in json) || !Array.isArray(json.paths)) {
        throw new Error('Multipart polyline payload must contain only polyline geometries.');
      }

      return json.paths as number[][][];
    });

    return parseGeometry({
      type: 'polyline',
      paths,
      ...(spatialReference ? { spatialReference } : {}),
    });
  }

  throw new Error('Unsupported multipart geometry payload.');
};

const ProjectSpecificContent = ({ projectId }: { projectId: number }) => {
  const tabRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<boolean>(true);
  const [selectedTab, setSelectedTab] = useState<string>('project');
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreparingEdit, setIsPreparingEdit] = useState(false);
  const [adjacentProjectsVisible, setAdjacentProjectsVisible] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editingInitialValues, setEditingInitialValues] = useState<FeatureFormInitialValues | null>(null);
  const [projectLayerVersion, setProjectLayerVersion] = useState(0);
  const { mapView, currentMapScale } = useMap();
  const { highlight, clear } = useHighlight(mapView);
  const {
    clearSelection,
    registerResolver,
    refreshSelection,
    selectFeature,
    selectedFeature,
    selectedFeatureIdentity,
    selectionOrigin,
    setMapSelectionEnabled,
  } = useFeatureSelection();
  const zoomSelectionRef = useRef(selected);
  const getProjectInfo = useAuthedCallable<ProjectRequest, ProjectResponse>('project');
  const getFeatureInfo = useCallableData<FeatureRequest, FeatureIntersections>('feature');
  const deleteFeatureFn = useAuthedCallable<DeleteFeatureRequest, DeleteFeatureResponse>('deleteFeature');
  const createFeatureFn = useAuthedCallable<CreateFeatureRequest, CreateFeatureResponse>('createFeature');
  const updateFeatureFn = useAuthedCallable<UpdateFeatureRequest, UpdateFeatureResponse>('updateFeature');

  const queryClient = useQueryClient();

  const logDeleteFeatureResult = (results: __esri.EditsResult, featureId: number) => {
    const deleteResult = results.deleteFeatureResults?.[0];

    if (!deleteResult) {
      console.error(
        'Failed to remove feature from map layer:',
        new Error('No deleteFeatureResults returned from applyEdits'),
      );
      return;
    }

    if ('error' in deleteResult && deleteResult.error) {
      console.error('Failed to remove feature from map layer:', deleteResult.error);
      return;
    }

    console.log(`Feature removed from map layer: ${featureId}`);
  };

  const deleteMutation = useMutation({
    mutationFn: async ({
      featureId,
      featureType,
    }: {
      featureId: number;
      featureType: string;
      featureKind: FeatureKind;
    }) => {
      await deleteFeatureFn({ projectId, featureId, featureType });
    },
    onSuccess: (_data, variables) => {
      setFeatureError(null);
      if (selectedFeatureIdentity?.projectId === projectId && selectedFeatureIdentity.id === variables.featureId) {
        clearSelection();
      }
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.removeQueries({
        queryKey: ['featureDetails', projectId, variables.featureId, variables.featureType.toLowerCase()],
      });

      const layer = getFeatureLayer(variables.featureKind);
      if (!layer) return;

      layer
        .queryFeatures({ where: `FeatureID=${variables.featureId}`, returnGeometry: false })
        .then((results) => layer.applyEdits({ deleteFeatures: results.features }))
        .then((results) => logDeleteFeatureResult(results, variables.featureId))
        .catch((error) => console.error('Failed to remove feature from map layer:', error));
    },
    onError: (error) => setFeatureError(error.message ?? 'Failed to delete feature'),
  });

  const getFeatureLayer = useCallback(
    (kind: FeatureKind) =>
      mapView?.map?.findLayerById(`project-${projectId}-feature-${kind}`) as __esri.FeatureLayer | undefined | null,
    [mapView, projectId],
  );

  const closeEditMode = useCallback(() => {
    setEditError(null);
    setEditingInitialValues(null);
    setIsPreparingEdit(false);
    setIsEditing(false);
  }, []);

  const logAddFeatureResult = (results: __esri.EditsResult, featureId: number) => {
    console.log('Add feature results from applyEdits:', results);
    const addResult = results.addFeatureResults?.[0];

    if (!addResult) {
      console.error('Failed to add feature to map layer:', new Error('No addFeatureResults returned from applyEdits'));
      return;
    }

    if ('error' in addResult && addResult.error) {
      console.error('Failed to add feature to map layer:', addResult.error);
      return;
    }

    console.log(`Feature added to map layer: ${featureId}`);
  };

  const logUpdateFeatureResult = (results: __esri.EditsResult, featureId: number) => {
    const updateResult = results.updateFeatureResults?.[0];

    if (!updateResult) {
      console.error(
        'Failed to update feature in map layer:',
        new Error('No updateFeatureResults returned from applyEdits'),
      );
      return;
    }

    if ('error' in updateResult && updateResult.error) {
      console.error('Failed to update feature in map layer:', updateResult.error);
      return;
    }

    console.log(`Feature updated in map layer: ${featureId}`);
  };

  const createMutation = useMutation({
    mutationFn: async (formData: CreateFeatureData) => {
      setCreateError(null);
      return createFeatureFn(formData);
    },
    onSuccess: (_data, variables) => {
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      const featureTable = editingDomainsQuery.data?.featureTypes[variables.featureType];

      if (!featureTable) {
        const errorMessage = `Unable to determine map layer for feature type "${variables.featureType}".`;
        console.error(errorMessage, {
          featureType: variables.featureType,
          featureId: _data.featureId,
        });
        setCreateError(errorMessage);
        return;
      }

      const kind: FeatureKind = featureTable.toLowerCase() as FeatureKind;
      const layer = getFeatureLayer(kind);

      if (layer) {
        let geom: __esri.Geometry;

        try {
          geom = buildDisplayGeometry(variables.geometry);
        } catch (error) {
          const failure = error instanceof Error ? error : new Error('Failed to build display geometry.');
          console.error('Failed to build feature geometry for map layer:', failure, {
            featureType: variables.featureType,
            featureId: _data.featureId,
          });
          setCreateError(failure.message);
          return;
        }

        const graphic = new Graphic({
          geometry: geom,
          attributes: {
            FeatureID: _data.featureId,
            Project_ID: variables.projectId,
            TypeDescription: variables.featureType,
            StatusDescription: _data.statusDescription,
            Title: null,
            _opacity: kind === 'poly' ? POLY_OPACITY : 1,
          },
        });
        layer
          .applyEdits({ addFeatures: [graphic] })
          .then((results) => logAddFeatureResult(results, _data.featureId))
          .catch((error) => console.error('Failed to add feature to map layer:', error));
      }
    },
    onError: (error) => setCreateError(error.message ?? 'Failed to create feature'),
  });

  const editMutation = useMutation({
    mutationFn: async (formData: UpdateFeatureData & { featureKind: FeatureKind }) => {
      setEditError(null);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { featureKind: _featureKind, ...request } = formData;

      return updateFeatureFn(request);
    },
    onSuccess: (_data, variables) => {
      closeEditMode();
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({
        queryKey: ['featureDetails', projectId, variables.featureId, variables.featureType.toLowerCase()],
      });
      setSelectedTab('features');

      const layer = getFeatureLayer(variables.featureKind);

      if (!layer) {
        return;
      }

      let geom: __esri.Geometry;

      try {
        geom = buildDisplayGeometry(variables.geometry);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error('Failed to build display geometry.');
        console.error('Failed to build updated feature geometry for map layer:', failure, {
          featureType: variables.featureType,
          featureId: _data.featureId,
        });
        setFeatureError(failure.message);
        return;
      }

      layer
        .queryFeatures({ where: `FeatureID=${variables.featureId}`, outFields: ['*'], returnGeometry: false })
        .then((results) => {
          const feature = results.features[0];

          if (!feature) {
            throw new Error(`Feature ${variables.featureId} not found in map layer.`);
          }

          feature.geometry = geom;
          feature.attributes.FeatureID = variables.featureId;
          feature.attributes.Project_ID = variables.projectId;
          feature.attributes.TypeDescription = variables.featureType;
          feature.attributes.StatusDescription = _data.statusDescription;

          return layer.applyEdits({ updateFeatures: [feature] });
        })
        .then((results) => logUpdateFeatureResult(results, variables.featureId))
        .catch((error) => {
          console.error('Failed to update feature in map layer:', error);
          setFeatureError(error instanceof Error ? error.message : 'Failed to update feature in map layer.');
        });
    },
    onError: (error) => setEditError(error.message ?? 'Failed to update feature'),
  });

  const allLayers = mapView?.map?.layers ?? new Collection();
  const referenceLayers = allLayers.filter((layer) => layer.id.startsWith('reference')) as Collection<ReferenceLayer>;

  const { data, status } = useQuery<ProjectResponse>({
    queryKey: ['project', projectId],
    queryFn: async () => getProjectInfo({ id: projectId }),
    enabled: projectId > 0,
  });

  const editingDomainsQuery = useEditingDomains(data?.allowEdits ?? false);
  const selectedFeatureId = selectedFeature?.id ?? null;
  const selectedFeatureType = selectedFeature?.type?.toLowerCase() ?? null;

  const { data: featureData, status: featureStatus } = useQuery<FeatureIntersections>({
    queryKey: ['featureDetails', projectId, selectedFeatureId, selectedFeatureType],
    queryFn: async () => {
      if (selectedFeatureId == null || !selectedFeatureType) {
        throw new Error('A feature must be selected before requesting feature details.');
      }

      return getFeatureInfo({
        type: selectedFeatureType,
        featureId: selectedFeatureId,
      });
    },
    enabled: selectedFeatureId != null,
  });

  const resolveProjectSelection = useCallback(
    (selection: FeatureSelectionIdentity) => {
      if (status !== 'success' || selection.projectId !== projectId) {
        return null;
      }

      return resolveSelectedFeature({
        kind: selection.kind,
        id: selection.id,
        polygons: data.polygons ?? {},
        lines: data.lines ?? [],
        points: data.points ?? [],
      });
    },
    [data, projectId, status],
  );

  useEffect(() => {
    zoomSelectionRef.current = selected;
  }, [selected]);

  useEffect(() => {
    registerResolver(status === 'success' ? resolveProjectSelection : null);

    return () => {
      registerResolver(null);
    };
  }, [registerResolver, resolveProjectSelection, status]);

  useEffect(() => {
    setMapSelectionEnabled(!(isCreating || isEditing));
  }, [isCreating, isEditing, setMapSelectionEnabled]);

  useEffect(() => {
    clearSelection();
  }, [clearSelection, projectId]);

  useEffect(() => {
    setIsCreating(false);
    closeEditMode();
    setCreateError(null);
    setFeatureError(null);
  }, [closeEditMode, projectId]);

  useEffect(() => {
    if (!mapView?.map) {
      return;
    }

    const handle = mapView.map.layers.on('change', (event) => {
      const changedProjectLayers = [...event.added, ...event.removed].some((layer) =>
        layer.id.startsWith(`project-${projectId}-feature-`),
      );

      if (changedProjectLayers) {
        setProjectLayerVersion((version) => version + 1);
      }
    });

    return () => {
      handle.remove();
    };
  }, [mapView, projectId]);

  useEffect(() => {
    if (!selectedFeatureIdentity || selectedFeatureIdentity.projectId !== projectId || status !== 'success') {
      return;
    }

    refreshSelection();
  }, [data, projectId, refreshSelection, selectedFeatureIdentity, status]);

  useEffect(() => {
    if (selectedFeatureIdentity?.projectId === projectId && selectionOrigin === 'map') {
      setSelectedTab('features');
    }
  }, [projectId, selectedFeatureIdentity, selectionOrigin]);

  const startEditingFeature = useCallback(
    async (featureId: number, _featureType: string, featureKind: FeatureKind) => {
      if (status !== 'success') {
        return;
      }

      const layer = getFeatureLayer(featureKind);

      if (!layer) {
        setFeatureError('Failed to locate the map layer for the selected feature.');
        return;
      }

      setFeatureError(null);
      setCreateError(null);
      setEditError(null);
      setIsCreating(false);
      setIsPreparingEdit(true);

      try {
        const selection = { projectId, kind: featureKind, id: featureId } satisfies FeatureSelectionIdentity;
        const results = await layer.queryFeatures({
          where: `FeatureID=${featureId}`,
          outFields: ['FeatureID'],
          returnGeometry: true,
        });
        const geometry = results.features[0]?.geometry?.clone() as __esri.Geometry | undefined;

        if (!geometry) {
          throw new Error('Failed to load the selected feature geometry.');
        }

        const initialValues = buildFeatureFormInitialValues(data, selection, geometry);

        if (!initialValues) {
          throw new Error('Failed to load the selected feature attributes.');
        }

        setEditingInitialValues(initialValues);
        setIsEditing(true);
        setSelectedTab('features');

        if (
          selectedFeatureIdentity?.projectId !== projectId ||
          selectedFeatureIdentity.kind !== featureKind ||
          selectedFeatureIdentity.id !== featureId
        ) {
          selectFeature(selection, 'list');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load feature for editing.';
        setFeatureError(message);
        closeEditMode();
      } finally {
        setIsPreparingEdit(false);
      }
    },
    [closeEditMode, data, getFeatureLayer, projectId, selectFeature, selectedFeatureIdentity, status],
  );

  useEffect(() => {
    if (!selectedFeature) {
      clear();

      return;
    }

    highlight(
      {
        layer: getProjectFeatureLayerId(projectId, selectedFeature.kind),
        id: selectedFeature.id,
      },
      { enabled: zoomSelectionRef.current, extentScale: 1.1 },
    );
  }, [clear, highlight, projectId, projectLayerVersion, selectedFeature, selectedFeatureIdentity]);

  return (
    <div className="mx-2 mb-2 grid grid-cols-1 gap-1 dark:text-zinc-100">
      <h2 className="text-xl font-bold">Project {projectId}</h2>
      <div className="flex flex-col gap-0 rounded border border-zinc-200 px-2 py-3 dark:border-zinc-700" ref={tabRef}>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {status === 'pending' && <List className="w-96" />}
          {status === 'success' && (
            <>
              <div className="flex justify-between">
                <p>
                  <a href={`/wri/project/title.html?id=${projectId}`}>{data.title}</a>
                </p>
                <ProjectStatusTag status={data.status} />
              </div>
              <div className="mb-0 mt-2 flex justify-center">
                <div className="mx-2 w-6">
                  <DiamondIcon className="size-2 fill-primary-400/50 text-primary-600" />
                </div>
                <div className="mx-2 w-6">
                  <DiamondIcon className="size-2 fill-accent-500/50 text-accent-700" />
                </div>
                <div className="mx-2 w-6">
                  <DiamondIcon className="size-2 fill-primary-400/50 text-primary-600" />
                </div>
              </div>
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => {
                  setSelectedTab(key as string);
                  setTimeout(
                    () =>
                      tabRef.current
                        ?.querySelector('[role="tab"][aria-selected="true"]')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
                    0,
                  );
                }}
                className="gap-0"
              >
                <div className="overflow-x-auto overflow-y-hidden pb-4 pt-1">
                  <TabList aria-label="Project details">
                    <Tab id="project" aria-label="Project details">
                      Project
                    </Tab>
                    <Tab id="features" aria-label="Features within the project">
                      Features
                    </Tab>
                    <Tab id="featureDetails" aria-label="Details of a selected feature">
                      Details
                    </Tab>
                    <Tab id="reference" aria-label="Reference data controls">
                      Reference
                    </Tab>
                  </TabList>
                </div>
                <TabPanel className="p-0" id="project">
                  <Group className="flex flex-col gap-y-1 dark:text-zinc-100">
                    <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                      <p>Description</p>
                      <p>{data.description}</p>
                    </div>
                    <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                      <p>Project manager</p>
                      <p>{data.manager}</p>
                    </div>
                    <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                      <p>Lead agency</p>
                      <p>{data.agency}</p>
                    </div>
                    <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                      <p>Region</p>
                      <p>{data.region}</p>
                    </div>
                    {data.affected && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Affected</p>
                        <p>{data.affected}</p>
                      </div>
                    )}
                    {data.terrestrial && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Terrestrial</p>
                        <p>{data.terrestrial}</p>
                      </div>
                    )}
                    {data.aquatic && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Aquatic and riparian</p>
                        <p>{data.aquatic}</p>
                      </div>
                    )}
                    {data.easement && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Easement and acquisition</p>
                        <p>{data.easement}</p>
                      </div>
                    )}
                    {data.stream && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Stream</p>
                        <p>{data.stream}</p>
                      </div>
                    )}
                    {(data.county?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold">
                        <p>County</p>
                        <ul className="pl-3">
                          {data.county.map((x: Record<string, string>) => (
                            <li key={x.name}>
                              {titleCase(x.name)} ({x.area})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(data.owner?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Land ownership</p>
                        <ul className="pl-3">
                          {data.owner.map((x: Record<string, string>) => (
                            <li key={`${x.owner}${x.admin}`}>
                              {x.owner}, {x.admin} ({x.area})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(data.sgma?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Sage grouse</p>
                        <ul className="pl-3">
                          {data.sgma.map((x: Record<string, string>) => (
                            <li key={x.name}>
                              {x.name} ({x.area})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <DownloadProjectData projectId={projectId} />
                    <UpdateProjectStatistics projectId={projectId} allowEdits={data.allowEdits} />
                  </Group>
                </TabPanel>
                <TabPanel shouldForceMount id="features" className="p-0 data-[inert]:hidden">
                  {isPreparingEdit || deleteMutation.isPending ? (
                    <List className="w-96" />
                  ) : isCreating ? (
                    <FeatureForm
                      projectId={projectId}
                      adjacentProjectsVisible={adjacentProjectsVisible}
                      domains={editingDomainsQuery.data}
                      mode="create"
                      isSaving={createMutation.isPending}
                      saveError={createError}
                      onCancel={() => {
                        setCreateError(null);
                        setIsCreating(false);
                      }}
                      onSave={(formData) => createMutation.mutate(formData)}
                    />
                  ) : isEditing && editingInitialValues ? (
                    <FeatureForm
                      projectId={projectId}
                      adjacentProjectsVisible={adjacentProjectsVisible}
                      domains={editingDomainsQuery.data}
                      mode="edit"
                      initialValues={editingInitialValues}
                      disableCategorySelection={true}
                      isSaving={editMutation.isPending}
                      saveError={editError}
                      onCancel={closeEditMode}
                      onSave={(formData) => {
                        if (!selectedFeatureIdentity || selectedFeatureIdentity.projectId !== projectId) {
                          setEditError('A feature must remain selected while editing.');
                          return;
                        }

                        editMutation.mutate({
                          ...formData,
                          featureId: selectedFeatureIdentity.id,
                          featureKind: selectedFeatureIdentity.kind,
                        });
                      }}
                    />
                  ) : (
                    <div className="grid grid-cols-1 items-center gap-2">
                      {data.allowEdits && (
                        <Button variant="secondary" className="w-full" onPress={() => setIsCreating(true)}>
                          Add Feature
                        </Button>
                      )}
                      <Switch aria-label="Zoom to selection" isSelected={selected} onChange={setSelected}>
                        Zoom to selection
                      </Switch>
                      <ProjectFeaturesList
                        projectId={projectId}
                        allowEdits={data.allowEdits}
                        polygons={data.polygons ?? {}}
                        lines={data.lines ?? []}
                        points={data.points ?? []}
                        isVisible={selectedTab === 'features'}
                        featureError={featureError}
                        onDismissFeatureError={() => setFeatureError(null)}
                        onEdit={startEditingFeature}
                        onDelete={(featureId, featureType, featureKind) =>
                          deleteMutation.mutate({ featureId, featureType, featureKind })
                        }
                        onViewDetails={() => setSelectedTab('featureDetails')}
                        renderOpacity={(layerId, oid) => {
                          const layer = mapView?.map?.findLayerById(layerId) as __esri.FeatureLayer | undefined | null;
                          if (!mapView?.ready || !layer) return null;

                          return <OpacityManager layer={layer as __esri.FeatureLayer} oid={oid} />;
                        }}
                      />
                    </div>
                  )}
                </TabPanel>
                <TabPanel shouldForceMount id="featureDetails" className="p-0 data-[inert]:hidden">
                  {deleteMutation.isPending ? (
                    <List className="w-96" />
                  ) : !selectedFeature ? (
                    <>Select a feature to view details</>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <p className="font-bold">{selectedFeature.type}</p>
                        {selectedFeature.size && (
                          <span
                            className="flex-none self-start whitespace-nowrap rounded border px-1 py-0.5 text-xs dark:border-zinc-600"
                            aria-label="Feature size"
                          >
                            {selectedFeature.size}
                          </span>
                        )}
                      </div>
                      {selectedFeature.isRetreatment && (
                        <div className="mb-2 rounded bg-amber-50 px-2 py-1 text-sm dark:bg-amber-900/20">
                          <span className="font-semibold">Retreatment</span>
                        </div>
                      )}
                      {selectedFeature.details && selectedFeature.details.length > 0 && (
                        <div className="mb-2">
                          <ol className="list-inside list-decimal space-y-1">
                            {selectedFeature.details.map((line, idx) => (
                              <li key={`${selectedFeature.id}-detail-${idx}`} className="text-sm">
                                {line}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {featureStatus === 'pending' && <List className="w-96" />}
                      {featureStatus === 'success' && featureData && (
                        <Group className="flex flex-col gap-y-1 dark:text-zinc-100">
                          {(featureData.stream?.length ?? 0) > 0 && (
                            <div className="[&>p:first-child]:font-bold">
                              <p>Stream miles</p>
                              <ul className="pl-3">
                                {featureData.stream.map((x: Record<string, string>, i) => (
                                  <li key={`${i}-${x.name}`}>
                                    {titleCase(x.name)} ({x.area})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(featureData.county?.length ?? 0) > 0 && (
                            <div className="[&>p:first-child]:font-bold">
                              <p>County</p>
                              <ul className="pl-3">
                                {featureData.county.map((x: Record<string, string>, i) => (
                                  <li key={`${i}-${x.name}`}>
                                    {titleCase(x.name)} ({x.area})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(featureData.owner?.length ?? 0) > 0 && (
                            <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                              <p>Land ownership</p>
                              <ul className="pl-3">
                                {featureData.owner.map((x: Record<string, string>) => (
                                  <li key={`${x.owner}${x.admin}`}>
                                    {x.owner}, {x.admin} ({x.area})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(featureData.sgma?.length ?? 0) > 0 && (
                            <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                              <p>Sage grouse</p>
                              <ul className="pl-3">
                                {featureData.sgma.map((x: Record<string, string>) => (
                                  <li key={x.name}>
                                    {x.name} ({x.area})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </Group>
                      )}
                    </>
                  )}
                </TabPanel>
                <TabPanel shouldForceMount id="reference" className="flex flex-col gap-2 p-0 data-[inert]:hidden">
                  <AdjacentProjects
                    mapView={mapView}
                    isSelected={adjacentProjectsVisible}
                    onChange={setAdjacentProjectsVisible}
                  />
                  {referenceLayers.length > 0 ? (
                    <div>
                      <ReferenceData layers={referenceLayers} currentMapScale={currentMapScale ?? 0} />
                      <ReferenceLabelSwitch layers={referenceLayers}>Labels</ReferenceLabelSwitch>
                    </div>
                  ) : (
                    <TagGroupLoader />
                  )}
                </TabPanel>
              </Tabs>
            </>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
};

export const ProjectSpecificView = ({ projectId }: { projectId: number }) => {
  return <ProjectSpecificContent projectId={projectId} />;
};
