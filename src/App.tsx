import esriConfig from '@arcgis/core/config.js';
import Collection from '@arcgis/core/core/Collection.js';
import { whenOnce } from '@arcgis/core/core/reactiveUtils.js';

import { Drawer } from '@ugrc/utah-design-system';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';
import { useOverlayTrigger } from 'react-aria';
import { ErrorBoundary } from 'react-error-boundary';
import { useOverlayTriggerState } from 'react-stately';
import { MapContainer } from './components';
import { projectStatus } from './components/data/filters.js';
import { FeatureData } from './components/FeatureData.tsx';
import { useMap } from './components/hooks';
import { ReferenceData, ReferenceLabelSwitch, ReferenceLayer } from './components/ReferenceData.tsx';
import config from './config.js';

const ErrorFallback = ({ error }: { error: Error }) => {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: 'red' }}>{error.message}</pre>
    </div>
  );
};

ErrorFallback.propTypes = {
  error: PropTypes.object,
};

esriConfig.assetsPath = './js/ugrc/assets';

export default function App() {
  const [viewReady, setViewReady] = useState<boolean>(false);
  const { mapView, currentMapScale } = useMap();

  const sideBarState = useOverlayTriggerState({ defaultOpen: window.innerWidth >= config.MIN_DESKTOP_WIDTH });
  const sideBarTriggerProps = useOverlayTrigger(
    {
      type: 'dialog',
    },
    sideBarState,
  );

  const trayState = useOverlayTriggerState({ defaultOpen: false });
  const trayTriggerProps = useOverlayTrigger(
    {
      type: 'dialog',
    },
    trayState,
  );


  const layers = (mapView?.map?.layers as Collection<ReferenceLayer>) ?? [];

  // when the layers have loaded
  useEffect(() => {
    whenOnce(() => !mapView?.updating).then(() => {
      setViewReady(true);
    });
  }, [mapView]);

  return (
    <main className="flex h-full flex-1 flex-col md:gap-2">
      <section className="relative flex min-h-0 flex-1 gap-2">
        <Drawer main state={sideBarState} {...sideBarTriggerProps}>
          <div className="mx-2 mb-2 grid grid-cols-1 gap-2">
            <h2 className="text-xl font-bold">Map controls</h2>
            <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <h5 className="dark:text-zinc-200">Search tool</h5>
              </ErrorBoundary>
            </div>
            <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <h5 className="dark:text-zinc-200">Project Status</h5>
                {viewReady && <FeatureData layers={layers} status={projectStatus} />}
              </ErrorBoundary>
            </div>
            <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <h5 className="dark:text-zinc-200">Feature Type</h5>
              </ErrorBoundary>
            </div>
            <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <h5 className="dark:text-zinc-200">Map Reference data</h5>
                <ReferenceData layers={layers} currentMapScale={currentMapScale ?? 0} />
                <ReferenceLabelSwitch layers={layers}>Labels</ReferenceLabelSwitch>
              </ErrorBoundary>
            </div>
          </div>
        </Drawer>
        <div className="relative flex flex-1 flex-col rounded border border-b-0 border-zinc-200 dark:border-0 dark:border-zinc-700">
          <div className="relative flex-1">
            <ErrorBoundary FallbackComponent={ErrorFallback}>
              <MapContainer />
            </ErrorBoundary>
            <Drawer
              type="tray"
              className="shadow-inner dark:shadow-white/20"
              allowFullScreen
              state={trayState}
              {...trayTriggerProps}
            >
              <section className="grid gap-2 px-7 pt-2">
                <h2 className="text-center">What&#39;s here?</h2>
              </section>
            </Drawer>
          </div>
        </div>
      </section>
    </main>
  );
}
