import { useMapReady } from '@ugrc/utilities/hooks';
import { useEffect, useRef, useState } from 'react';
import { tv } from 'tailwind-variants';
import { Status } from './ProjectStatus';

const tagStyles = tv({
  base: 'flex max-w-fit cursor-default items-center gap-1 rounded-md border px-3 py-0.5 text-xs text-white',
  variants: {
    status: {
      draft: 'border-gray-200 bg-zinc-500',
      proposed: 'border-gray-200 bg-zinc-800',
      current: 'border-gray-200 bg-sky-600',
      'pending completed': 'border-gray-200 bg-yellow-500',
      completed: 'border-gray-200 bg-green-700',
      cancelled: 'border-gray-200 bg-red-700',
      undefined: 'border-gray-200 bg-gray-200',
    },
  },
});

type GraphicAttributes = {
  Project_ID: number;
  Title: string;
  Status?: string;
  StatusDescription?: string;
};

export const Tooltip = ({ view, layers }: { view: __esri.MapView; layers: __esri.FeatureLayer[] }) => {
  const tooltipNode = useRef<HTMLDivElement | null>(null);
  const currentVisibleTooltipId = useRef<number | null>(null);

  const [hoverProject, setHoverProject] = useState<GraphicAttributes | null>(null);
  const isReady = useMapReady(view);

  useEffect(() => {
    if (!tooltipNode.current || !isReady) {
      return;
    }

    view.on('pointer-move', (event) => {
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
  }, [isReady, layers, view]);

  const status = (hoverProject?.Status ?? hoverProject?.StatusDescription)?.toLocaleLowerCase() as Status;

  return (
    <div ref={tooltipNode} className="absolute z-10 h-20 w-56 rounded border bg-white opacity-0 transition-opacity">
      <div className="p-2 text-sm">
        <h3 className="truncate text-sm font-bold">{hoverProject?.Title}</h3>
        <p>Project: {hoverProject?.Project_ID}</p>
        <div className={tagStyles({ status: status })}>{hoverProject?.Status ?? hoverProject?.StatusDescription}</div>
      </div>
    </div>
  );
};
