import esriConfig from '@arcgis/core/config.js';

import { ErrorBoundary } from 'react-error-boundary';
import { AreaOfInterest, MapContainer } from './components';

const ErrorFallback = ({ error }: { error: Error }) => {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: 'red' }}>{error.message}</pre>
    </div>
  );
};

esriConfig.assetsPath = import.meta.env.MODE === 'production' ? '/wri/js/ugrc/assets' : '/js/ugrc/assets';

export default function App() {
  return (
    <section className="dark:bg-zinc-800 dark:text-zinc-200">
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <AreaOfInterest />
        <MapContainer configuration="search" />
      </ErrorBoundary>
    </section>
  );
}
