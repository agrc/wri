import { Button, ToggleButton } from '@ugrc/utah-design-system';
import { useRef } from 'react';

export const AreaOfInterest = () => {
  const areaOfInterestNode = useRef<HTMLInputElement>(null);

  return (
    <div className="px-2">
      <h2>Area of Interest</h2>
      <div className="flex w-fit gap-2 py-3">
        <span>
          <ToggleButton onChange={(value) => (areaOfInterestNode.current!.value = value.toString())}>
            Draw a polygon
          </ToggleButton>
        </span>
        <span>
          <Button isDisabled>Upload a shapefile</Button>
        </span>
      </div>
      <input ref={areaOfInterestNode} id="aoiGeometry" type="text" className="hidden" />
    </div>
  );
};
