import { useMapReady } from '@ugrc/utilities/hooks';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { ProjectContext } from '../contexts';

const handleHashChange = (hash: string) => {
  console.log('id from hash change', hash);

  if (!hash.includes('=')) {
    return null;
  }

  const idAsString = hash.split('=')[1];
  if (!idAsString || idAsString.length === 0) {
    return null;
  }

  try {
    return parseInt(idAsString, 10);
  } catch {
    return null;
  }
};

export const useProjectNavigation = (view: __esri.MapView | null, layers: __esri.FeatureLayer[], enabled: boolean) => {
  const isReady = useMapReady(view);
  const context = useContext(ProjectContext);
  const clickHandler = useRef<__esri.Handle | null>(null);

  if (context === null) {
    throw new Error('useProjectNavigation must be used within a ProjectContext');
  }

  // only run on load
  useEffect(() => {
    context.setProjectId(handleHashChange(window.location.hash));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // map click on project features
  useEffect(() => {
    if (!enabled || !isReady || !view) {
      if (clickHandler.current) {
        clickHandler.current.remove();
        clickHandler.current = null;
      }

      return;
    }

    if (!clickHandler.current) {
      clickHandler.current = view.on('click', (event) => {
        const opts = {
          include: layers,
        };

        view.hitTest(event, opts).then((response) => {
          if (response.results.length) {
            const result = (response.results[0] as __esri.MapViewGraphicHit).graphic;

            const id = handleHashChange(`id=${result.attributes?.Project_ID}`);

            if (id) {
              context.setProjectId(id);
              window.location.hash = `id=${id}`;
            }
          }
        });
      });
    }

    return () => {
      if (clickHandler.current) {
        clickHandler.current.remove();
        clickHandler.current = null;
      }
    };
  }, [context, enabled, isReady, layers, view]);

  const setProjectId = useCallback(() => {
    context.setProjectId(handleHashChange(window.location.hash));
  }, [context]);

  // watch the hash for changes
  useEffect(() => {
    window.addEventListener('hashchange', setProjectId);

    return () => {
      window.removeEventListener('hashchange', () => setProjectId);
    };
  }, [context, setProjectId]);

  return context;
};
