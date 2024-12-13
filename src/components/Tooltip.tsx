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
  layers,
  enabled,
}: {
  view: __esri.MapView;
  layers: __esri.FeatureLayer[];
  enabled: boolean;
}) => {
  const tooltipNode = useRef<HTMLDivElement | null>(null);
  const currentVisibleTooltipId = useRef<number | null>(null);
  const pointerHandler = useRef<__esri.Handle | null>(null);
  const [hoverProject, setHoverProject] = useState<GraphicAttributes | null>(null);
  const isReady = useMapReady(view);

  useEffect(() => {
    if (!enabled || !tooltipNode.current || !isReady) {
      if (pointerHandler.current) {
        pointerHandler.current.remove();
        pointerHandler.current = null;
      }

      if (tooltipNode.current) {
        tooltipNode.current.classList.add('duration-1000');
        tooltipNode.current.classList.replace('opacity-90', 'opacity-0');
        currentVisibleTooltipId.current = null;
      }

      return;
    }

    pointerHandler.current = view.on('pointer-move', (event) => {
      const opts = {
        include: layers,
      };

      view.hitTest(event, opts).then((response) => {
        if (!tooltipNode.current) {
          return;
        }

        if (response.results.length) {
          const result = (response.results[0] as __esri.MapViewGraphicHit).graphic;

          if (currentVisibleTooltipId.current == result.attributes.Project_ID) {
            return;
          } else {
            currentVisibleTooltipId.current = result.attributes.Project_ID;
            setHoverProject(result.attributes);
          }

          const screenPoint = view.toScreen((result.geometry as __esri.Polygon)?.centroid ?? result.geometry);
          let top = screenPoint.y - (tooltipNode.current.offsetHeight + 10);

          if (top < tooltipNode.current.offsetHeight + 10) {
            top = screenPoint.y + 10;
          }

          tooltipNode.current.style.setProperty('top', `${top}px`);
          tooltipNode.current.style.setProperty('left', `${screenPoint.x - (tooltipNode.current.offsetWidth + 5)}px`);
          tooltipNode.current.classList.add('opacity-90');
          tooltipNode.current.classList.remove('duration-1000');
        } else {
          tooltipNode.current.classList.add('duration-1000');
          tooltipNode.current.classList.replace('opacity-90', 'opacity-0');
          currentVisibleTooltipId.current = null;
        }
      });
    });

    return () => {
      if (pointerHandler.current) {
        pointerHandler.current.remove();
        pointerHandler.current = null;
      }
    };
  }, [enabled, isReady, layers, view]);

  return (
    <div
      ref={tooltipNode}
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
