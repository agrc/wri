import { useMapReady } from '@ugrc/utilities/hooks';
import { useCallback, useContext, useEffect, useRef, type RefObject } from 'react';
import { ProjectContext } from '../contexts';

const handleHashChange = (hash: string) => {
  // Normalize and parse the hash using URLSearchParams
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const idParam = params.get('id');

  if (!idParam) {
    return null;
  }

  const id = parseInt(idParam, 10);

  return Number.isFinite(id) ? id : null;
};

export const useProjectNavigation = (
  viewRef: RefObject<__esri.MapView | null>,
  layersRef: RefObject<__esri.FeatureLayer[]>,
  enabled: boolean,
) => {
  const isReady = useMapReady(viewRef.current);
  const context = useContext(ProjectContext);
  const clickHandler = useRef<__esri.Handle | null>(null);

  if (context === null) {
    throw new Error('useProjectNavigation must be used within a ProjectContext');
  }

  const setProjectId = useCallback(() => {
    context.setProjectId(handleHashChange(window.location.hash));
  }, [context]);

  const updateProjectId = useCallback(
    (id: number | null) => {
      if (id === null) {
        return;
      }

      context.setProjectId(id);
      window.location.hash = `id=${id}`;
    },
    [context],
  );

  // only run on load
  useEffect(() => {
    setProjectId();
  }, [setProjectId]);

  // map click on project features
  useEffect(() => {
    if (!enabled || !isReady || !viewRef.current || !(layersRef.current && layersRef.current.length > 0)) {
      if (clickHandler.current) {
        clickHandler.current.remove();
        clickHandler.current = null;
      }

      return;
    }

    if (!clickHandler.current) {
      clickHandler.current = viewRef.current.on('click', (event) => {
        const opts = {
          include: layersRef.current,
        };

        viewRef.current!.hitTest(event, opts).then((response) => {
          if (response.results.length) {
            const result = (response.results[0] as __esri.MapViewGraphicHit).graphic;

            const id = handleHashChange(`id=${result.attributes?.Project_ID}`);

            updateProjectId(id);
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
  }, [enabled, isReady, viewRef, layersRef, updateProjectId]);

  // watch the hash for changes
  useEffect(() => {
    window.addEventListener('hashchange', setProjectId);

    return () => {
      window.removeEventListener('hashchange', setProjectId);
    };
  }, [setProjectId]);

  return context;
};
