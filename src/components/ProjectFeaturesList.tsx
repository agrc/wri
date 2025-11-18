import React, { type JSX } from 'react';
import {
  GridList,
  GridListItem,
  Toolbar,
  type GridListItemRenderProps,
  type Key,
  type Selection,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { Feature, PolygonFeatures } from './ProjectSpecific';
import { composeTailwindRenderProps } from './utils';

export type FeatureDetails = { layer: string; id: number };

type Props = {
  projectId: number;
  polygons: PolygonFeatures;
  lines: Feature[];
  points: Feature[];
  onSelect: (details: FeatureDetails) => boolean | void;
  onClear?: () => void;
  renderOpacity?: (layerId: string, oid?: number) => JSX.Element | null;
};

function parseActionId(key?: Key | Set<Key>): FeatureDetails | undefined {
  try {
    if (!key) {
      return undefined;
    }

    let str: string | undefined;
    if (typeof key === 'string') {
      str = key as string;
    } else if (key instanceof Set) {
      const first = Array.from(key)[0] as Key | undefined;
      if (typeof first === 'string') {
        str = first as string;
      }
    } else if (typeof key === 'number') {
      str = String(key);
    }

    if (!str) {
      return undefined;
    }

    return JSON.parse(str) as FeatureDetails;
  } catch (error) {
    console.debug('Failed to parse action ID:', error);

    return undefined;
  }
}

const classes = tv({
  base: 'relative flex transform-gpu flex-col gap-y-2 rounded-md px-2 py-1 transition',
  variants: {
    isSelected: {
      true: 'selected:scale-105 selected:ring-2 selected:ring-inset selected:ring-secondary-600 selected:focus:ring-2 selected:focus:ring-accent-300 dark:selected:ring-primary-600 dark:selected:focus:ring-accent-300',
      false: '',
    },
    isFocusVisible: {
      true: 'focus:outline-0 focus:ring-2 focus:ring-accent-300 focus:ring-offset-0',
      false: '',
    },
  },
});

export const ProjectFeaturesList: React.FC<Props> = ({
  projectId,
  polygons,
  lines,
  points,
  onSelect,
  onClear,
  renderOpacity,
}) => {
  const renderItemClass = (values?: GridListItemRenderProps & { defaultClassName?: string | undefined }) => {
    const defaultClassName = values?.defaultClassName as string | undefined;
    const isSelected = !!values?.isSelected;
    const isFocusVisible = !!values?.isFocusVisible;
    const tvProps = {
      isSelected,
      isFocusVisible,
      className: defaultClassName,
    };

    return classes(tvProps);
  };
  return (
    <GridList
      selectionMode="single"
      className="flex flex-col gap-y-2 dark:text-zinc-100"
      onSelectionChange={(selection: Selection) => {
        if (!selection) {
          onClear?.();

          return;
        }

        const keyArr = Array.from(selection as Set<Key>);
        if (keyArr.length === 0) {
          onClear?.();
          return;
        }

        const details = parseActionId(keyArr[0]);
        if (!details) {
          return;
        }

        const isActive = onSelect(details);
        if (isActive === false) {
          onClear?.();
        }
      }}
    >
      {Object.values(polygons ?? {}).map((feature, i) => (
        <GridListItem
          key={`${i}-${feature[0]?.type}`}
          id={JSON.stringify({ layer: `project-${projectId}-feature-poly`, id: feature[0]?.id })}
          className={composeTailwindRenderProps(renderItemClass, '')}
        >
          <div>
            <div className="flex justify-between">
              <p className="font-bold">{feature[0]?.type}</p>
              <p className="flex-none self-start whitespace-nowrap rounded border px-1 py-0.5 text-xs dark:border-zinc-600">
                {feature[0]?.size}
              </p>
            </div>
            {feature[0]?.retreatment?.toUpperCase() === 'Y' && <p>Retreatment</p>}
            {feature.some((pt) => pt?.action || pt?.subtype) && (
              <ol className="list-inside list-decimal pl-2">
                {feature.map((pt) => (
                  <li key={[pt?.action, pt?.subtype, pt?.herbicide].filter(Boolean).join(' - ')}>
                    {[pt?.action, pt?.subtype, pt?.herbicide].filter(Boolean).join(' - ')}
                  </li>
                ))}
              </ol>
            )}
            {feature[0]?.description && <p className="pl-2">{feature[0].description}</p>}
          </div>
          <Toolbar aria-label="Feature options" className="flex gap-x-1">
            {renderOpacity && renderOpacity(`project-${projectId}-feature-poly`, feature[0]?.id)}
          </Toolbar>
        </GridListItem>
      ))}

      {lines.map((feature, i) => (
        <GridListItem
          key={`${i}-${feature?.type}`}
          id={`{"layer":"project-${projectId}-feature-line","id":${feature?.id}}`}
          className={composeTailwindRenderProps(renderItemClass, '')}
        >
          <div>
            <div className="flex justify-between">
              <p className="font-bold">{feature?.type}</p>
              <p className="flex-none self-start whitespace-nowrap rounded border px-1 py-0.5 text-xs dark:border-zinc-600">
                {feature?.size}
              </p>
            </div>
            <p className="pl-2">{[feature?.action, feature?.subtype].filter(Boolean).join(' - ')}</p>
            {feature?.description && <p className="pl-2">{feature.description}</p>}
          </div>
          <Toolbar aria-label="Feature options" className="flex gap-x-1">
            {renderOpacity && renderOpacity(`project-${projectId}-feature-line`, feature?.id)}
          </Toolbar>
        </GridListItem>
      ))}

      {points.map((feature, i) => (
        <GridListItem
          key={`${i}-${feature?.type}`}
          id={`{"layer":"project-${projectId}-feature-point","id":${feature?.id}}`}
          className={composeTailwindRenderProps(renderItemClass, '')}
        >
          <div>
            <div className="flex justify-between">
              <p className="font-bold">{feature?.type}</p>
              <p className="flex-none self-start whitespace-nowrap rounded border px-1 py-0.5 text-xs dark:border-zinc-600">
                {feature?.size}
              </p>
            </div>
            <div className="pl-2">
              {(feature?.subtype || feature?.action) && (
                <p>{[feature?.subtype, feature?.action].filter(Boolean).join(' - ')}</p>
              )}
              {feature?.description && <p className="pl-2">{feature.description}</p>}
            </div>
          </div>
          <Toolbar aria-label="Feature options" className="flex gap-x-1">
            {renderOpacity && renderOpacity(`project-${projectId}-feature-point`, feature?.id)}
          </Toolbar>
        </GridListItem>
      ))}
    </GridList>
  );
};

export default ProjectFeaturesList;
