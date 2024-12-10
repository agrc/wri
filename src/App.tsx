import esriConfig from '@arcgis/core/config.js';
import Collection from '@arcgis/core/core/Collection.js';
import { Drawer } from '@ugrc/utah-design-system';
import { useContext } from 'react';
import { useOverlayTrigger } from 'react-aria';
import { ErrorBoundary } from 'react-error-boundary';
import { useOverlayTriggerState } from 'react-stately';
import { DrawerView, ErrorFallback, MapContainer } from './components';
import { FilterProvider, ProjectContext } from './components/contexts';
import { useMap } from './components/hooks';
import config from './config.js';

esriConfig.assetsPath = import.meta.env.MODE === 'production' ? '/wri/js/ugrc/assets' : '/js/ugrc/assets';

export default function App() {
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

  const { mapView } = useMap();
  const allLayers = mapView?.map?.layers ?? new Collection();
  const featureLayers = allLayers.filter((layer) => layer.id.startsWith('feature')) as Collection<__esri.FeatureLayer>;
  const projectContext = useContext(ProjectContext);

  let projectId = null;
  if (projectContext !== null) {
    projectId = projectContext.projectId;
  }

  return (
    <main className="flex h-full flex-1 flex-col md:gap-2">
      <section className="relative flex min-h-0 flex-1 overflow-x-hidden md:mr-2">
        <Drawer main state={sideBarState} {...sideBarTriggerProps}>
          <FilterProvider featureLayers={featureLayers}>
            <DrawerView projectId={projectId} />
          </FilterProvider>
        </Drawer>
        <div className="relative flex flex-1 flex-col rounded border border-b-0 border-zinc-200 dark:border-0 dark:border-zinc-700">
          <div className="relative flex-1">
            <ErrorBoundary FallbackComponent={ErrorFallback}>
              <MapContainer configuration="edit" />
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
