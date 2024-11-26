import { Button, Switch } from '@ugrc/utah-design-system';
import { LockIcon, UnlockIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMap } from './hooks';

const defaultSwitchScale = 75000; // level 13

export const CentroidToggle = () => {
  const [selected, setSelected] = useState<boolean>(false);
  const [locked, setLocked] = useState<boolean>(false);
  const { currentMapScale, mapView } = useMap();

  useEffect(() => {
    setSelected((currentMapScale ?? 0) >= defaultSwitchScale);
  }, [currentMapScale]);

  useEffect(() => {
    if (!mapView || !mapView?.map) {
      return;
    }

    if (locked) {
      return;
    }

    try {
      mapView.map.findLayerById('feature-centroids').visible = selected;
    } catch {
      console.error('Error setting feature-centroid visibility');
    }
    try {
      mapView.map.findLayerById('feature-poly').visible = !selected;
    } catch {
      console.error('Error setting feature-poly visibility');
    }
    try {
      mapView.map.findLayerById('feature-line').visible = !selected;
    } catch {
      console.error('Error setting feature-line visibility');
    }
    try {
      mapView.map.findLayerById('feature-point').visible = !selected;
    } catch {
      console.error('Error setting feature-point visibility');
    }
  });

  return (
    <div>
      <Switch aria-label="Toggle project centroids" isSelected={selected} onChange={setSelected} isDisabled={locked}>
        Project centroids
      </Switch>
      <div className="flex items-center gap-1 pl-2">
        <Button
          variant="icon"
          className="min-h-0 px-0.5"
          aria-label="Lock centroids or features"
          onPress={() => setLocked(!locked)}
        >
          {locked ? <LockIcon className="size-5" /> : <UnlockIcon className="size-5" />}
        </Button>
        <span className="text-sm italic text-zinc-600 dark:text-zinc-400">{locked ? 'Unlock' : 'Lock'} choice</span>
      </div>
      <p className="pt-0.5 text-sm italic text-zinc-600 dark:text-zinc-400">
        Displaying {selected ? 'project centroids' : 'all project features'}.
      </p>
    </div>
  );
};
