import { useMapReady } from '@ugrc/utilities/hooks';
import { useEffect, useRef, useState } from 'react';
import { ProjectStatusTag } from './ProjectStatusTag';

type GraphicAttributes = {
  Project_ID: number;
  Title: string;
  Status?: string;
  StatusDescription?: string;
};

export const Tooltip = ({
  view,
  layersRef,
  enabled,
}: {
  view: __esri.MapView;
  layersRef: React.RefObject<__esri.FeatureLayer[]>;
  enabled: boolean;
}) => {
  const tooltipNode = useRef<HTMLDivElement | null>(null);
  const currentVisibleTooltipId = useRef<number | null>(null);
  const pointerHandler = useRef<__esri.Handle | null>(null);
  const [hoverProject, setHoverProject] = useState<GraphicAttributes | null>(null);
  const isReady = useMapReady(view);

  // Clear content after opacity transition completes to avoid visible content swap
  useEffect(() => {
    const node = tooltipNode.current;

    if (!node) {
      return;
    }

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'opacity') {
        return;
      }

      if (node.classList.contains('opacity-0')) {
        setHoverProject(null);
        currentVisibleTooltipId.current = null;
      }
    };

    node.addEventListener('transitionend', onTransitionEnd);

    return () => {
      node.removeEventListener('transitionend', onTransitionEnd);
    };
  }, []);

  // cache tooltip size to avoid repeated layout reads
  const tooltipSize = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  useEffect(() => {
    if (tooltipNode.current) {
      const rect = tooltipNode.current.getBoundingClientRect();
      tooltipSize.current = { width: rect.width, height: rect.height };
    }
  }, []);

  useEffect(() => {
    if (!enabled || !tooltipNode.current || !isReady || !(layersRef.current && layersRef.current.length)) {
      if (pointerHandler.current) {
        pointerHandler.current.remove();
        pointerHandler.current = null;
      }

      if (tooltipNode.current) {
        tooltipNode.current.classList.add('duration-1000');
        tooltipNode.current.classList.replace('opacity-90', 'opacity-0');
      }

      return;
    }

    let rafId: number | null = null;
    let token = 0;
    const lastEvent = { x: 0, y: 0 } as { x: number; y: number };

    const isVisible = () => tooltipNode.current?.classList.contains('opacity-90');

    const process = () => {
      rafId = null;
      const localToken = ++token;
      const include = layersRef.current ?? [];

      const screenPoint: __esri.MapViewScreenPoint = { x: lastEvent.x, y: lastEvent.y } as __esri.MapViewScreenPoint;
      view
        .hitTest(screenPoint, { include })
        .then((response) => {
          if (localToken !== token) {
            return; // stale
          }

          if (!tooltipNode.current) {
            return;
          }

          if (response.results.length) {
            const result = (response.results[0] as __esri.MapViewGraphicHit).graphic;
            const newId = result.attributes?.Project_ID as number | undefined;
            const visible = isVisible();

            // If tooltip is visible and a different feature is under cursor, don't swap content; just reposition
            if (
              visible &&
              currentVisibleTooltipId.current != null &&
              newId != null &&
              newId !== currentVisibleTooltipId.current
            ) {
              let sp: __esri.MapViewScreenPoint | null | undefined = { x: lastEvent.x, y: lastEvent.y };
              if (result.geometry?.type === 'point') {
                sp = view.toScreen(result.geometry as __esri.Point);
              }

              if (!sp) {
                return;
              }

              const containerEl = view.container as HTMLDivElement;
              const cw = containerEl?.clientWidth ?? 0;
              const ch = containerEl?.clientHeight ?? 0;
              const tw = tooltipSize.current.width || tooltipNode.current.offsetWidth;
              const th = tooltipSize.current.height || tooltipNode.current.offsetHeight;

              let top = sp.y - (th + 10);
              if (top < 0) {
                top = sp.y + 10;
              }
              // Place to the left of cursor; clamp within view container element
              let left = sp.x - (tw + 5);
              if (left < 0) {
                left = 5;
              }
              if (left + tw > cw) {
                left = Math.max(5, cw - tw - 5);
              }
              if (top + th > ch) {
                top = Math.max(5, ch - th - 5);
              }

              tooltipNode.current.style.setProperty('top', `${top}px`);
              tooltipNode.current.style.setProperty('left', `${left}px`);

              return; // keep current content
            }

            // Only skip if same feature AND already visible; otherwise re-show
            if (newId != null && currentVisibleTooltipId.current === newId && visible) {
              return;
            }

            currentVisibleTooltipId.current = newId ?? null;
            setHoverProject(result.attributes as GraphicAttributes);

            let sp: __esri.MapViewScreenPoint | null | undefined = { x: lastEvent.x, y: lastEvent.y };
            if (result.geometry?.type === 'point') {
              sp = view.toScreen(result.geometry as __esri.Point);
            }

            if (!sp) {
              return;
            }

            const containerEl = view.container as HTMLDivElement;
            const cw = containerEl?.clientWidth ?? 0;
            const ch = containerEl?.clientHeight ?? 0;
            const tw = tooltipSize.current.width || tooltipNode.current.offsetWidth;
            const th = tooltipSize.current.height || tooltipNode.current.offsetHeight;

            // Prefer above the cursor. If not enough room, place below.
            let top = sp.y - (th + 10);
            if (top < 0) {
              top = sp.y + 10;
            }
            // Place to the left of cursor; clamp within view container element
            let left = sp.x - (tw + 5);

            if (left < 0) {
              left = 5;
            }

            if (left + tw > cw) {
              left = Math.max(5, cw - tw - 5);
            }

            if (top + th > ch) {
              top = Math.max(5, ch - th - 5);
            }

            tooltipNode.current.style.setProperty('top', `${top}px`);
            tooltipNode.current.style.setProperty('left', `${left}px`);
            tooltipNode.current.classList.replace('opacity-0', 'opacity-90');
            tooltipNode.current.classList.remove('duration-1000');
          } else {
            tooltipNode.current.classList.add('duration-1000');
            tooltipNode.current.classList.replace('opacity-90', 'opacity-0');
            // Do not clear content immediately; wait for transitionend
          }
        })
        .catch(() => {});
    };

    pointerHandler.current = view.on('pointer-move', (event) => {
      lastEvent.x = event.x;
      lastEvent.y = event.y;

      if (rafId == null) {
        rafId = requestAnimationFrame(process);
      }
    });

    return () => {
      if (pointerHandler.current) {
        pointerHandler.current.remove();
        pointerHandler.current = null;
      }

      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [enabled, isReady, layersRef, view]);

  return (
    <div
      ref={tooltipNode}
      role="tooltip"
      aria-hidden={!tooltipNode.current?.classList.contains('opacity-90')}
      className="pointer-events-none absolute z-10 h-20 w-56 rounded border bg-white opacity-0 transition-opacity"
    >
      <div className="p-2 text-sm">
        <h3 className="truncate text-sm font-bold">{hoverProject?.Title}</h3>
        <p>Project: {hoverProject?.Project_ID}</p>
        <ProjectStatusTag status={hoverProject?.Status ?? hoverProject?.StatusDescription ?? ''} />
      </div>
    </div>
  );
};
