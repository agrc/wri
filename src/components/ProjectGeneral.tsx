import Collection from '@arcgis/core/core/Collection';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { useContext } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { CentroidToggle, ErrorFallback, FeatureData, ProjectStatus, Search, TagGroupLoader } from './';
import { FilterContext } from './contexts';
import { useMap } from './hooks';
import { ReferenceData, ReferenceLabelSwitch, type ReferenceLayer } from './ReferenceData';
import { WriFundingToggle } from './WriFundedToggle';

const FilterErrorMessage = ({ message }: { message: string }) => {
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
};

export const GeneralView = () => {
  const { mapView, currentMapScale } = useMap();
  const { featureTypes, filtersError, filtersLoading, projectStatus } = useContext(FilterContext);

  const allLayers = mapView?.map?.layers ?? new Collection();
  const featureLayers = allLayers.filter((layer) => layer.id.startsWith('feature')) as Collection<FeatureLayer>;
  const referenceLayers = allLayers.filter((layer) => layer.id.startsWith('reference')) as Collection<ReferenceLayer>;

  return (
    <div className="mx-2 mb-2 grid grid-cols-1 gap-2">
      <h2 className="text-xl font-bold dark:text-zinc-200">Map controls</h2>
      <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <h5 className="dark:text-zinc-200">Search tool</h5>
          {mapView && <Search view={mapView} />}
        </ErrorBoundary>
      </div>
      <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <h5 className="dark:text-zinc-200">Project Status</h5>
          {featureLayers.length > 0 ? (
            filtersLoading ? (
              <TagGroupLoader />
            ) : filtersError ? (
              <FilterErrorMessage message={filtersError} />
            ) : (
              <ProjectStatus status={projectStatus} />
            )
          ) : (
            <TagGroupLoader />
          )}
          {featureLayers.length > 0 && <CentroidToggle />}
          {featureLayers.length > 0 && <WriFundingToggle />}
        </ErrorBoundary>
      </div>
      <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <h5 className="dark:text-zinc-200">Feature Type</h5>
          {featureLayers.length > 0 ? (
            filtersLoading ? (
              <TagGroupLoader />
            ) : filtersError ? (
              <FilterErrorMessage message={filtersError} />
            ) : (
              <FeatureData featureTypes={featureTypes} />
            )
          ) : (
            <TagGroupLoader />
          )}
        </ErrorBoundary>
      </div>
      <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <h5 className="dark:text-zinc-200">Map Reference data</h5>
          {referenceLayers.length > 0 ? (
            <>
              <ReferenceData layers={referenceLayers} currentMapScale={currentMapScale ?? 0} />
              <ReferenceLabelSwitch layers={referenceLayers}>Labels</ReferenceLabelSwitch>
            </>
          ) : (
            <TagGroupLoader />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
};
